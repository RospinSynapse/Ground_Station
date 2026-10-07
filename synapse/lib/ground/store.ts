import type { Client } from '@libsql/client';
import { assembleImage, parsePacket, type ClassificationPacket, type FlightPacket } from './protocol';

export class PacketConflict extends Error {}
export async function initializeGroundStore(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS flight_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL,
    packet_id TEXT NOT NULL, type TEXT NOT NULL, image_id TEXT,
    received_at TEXT NOT NULL, payload TEXT NOT NULL,
    UNIQUE(mission_id, packet_id))`);
  await client.execute('CREATE INDEX IF NOT EXISTS flight_image ON flight_packets(mission_id, image_id)');
}
export async function savePacket(client: Client, input: unknown) {
  const packet = parsePacket(input);
  const payload = JSON.stringify(packet);
  const tx = await client.transaction('write');
  try {
    const old = await tx.execute({ sql: 'SELECT payload FROM flight_packets WHERE mission_id=? AND packet_id=?', args: [packet.missionId, packet.packetId] });
    if (old.rows.length) {
      if (old.rows[0].payload !== payload) throw new PacketConflict('Packet ID reused with different content');
      await tx.commit(); return { duplicate: true };
    }
    if (packet.type === 'classification') {
      const previous = await tx.execute({ sql: 'SELECT payload FROM flight_packets WHERE mission_id=? AND image_id=?', args: [packet.missionId, packet.imageId] });
      try {
        assembleImage([...previous.rows.map(r => JSON.parse(String(r.payload)) as ClassificationPacket), packet]);
      } catch (error) { throw new PacketConflict((error as Error).message); }
    }
    await tx.execute({ sql: 'INSERT INTO flight_packets(mission_id, packet_id, type, image_id, received_at, payload) VALUES (?, ?, ?, ?, ?, ?)', args: [packet.missionId, packet.packetId, packet.type, packet.type === 'classification' ? packet.imageId : null, new Date().toISOString(), payload] });
    await tx.commit(); return { duplicate: false };
  } finally { tx.close(); }
}
export async function getGroundSnapshot(client: Client) {
  const recent = await client.execute('SELECT id, received_at, payload FROM flight_packets ORDER BY id DESC LIMIT 100');
  const latest = await client.execute("SELECT received_at, payload FROM flight_packets WHERE type='telemetry' ORDER BY id DESC LIMIT 1");
  const keys = await client.execute("SELECT mission_id, image_id, MAX(id) AS newest FROM flight_packets WHERE type='classification' GROUP BY mission_id, image_id ORDER BY newest DESC LIMIT 20");
  const images = [];
  for (const key of keys.rows) {
    const rows = await client.execute({ sql: 'SELECT payload FROM flight_packets WHERE mission_id=? AND image_id=? ORDER BY id', args: [key.mission_id, key.image_id] });
    const chunks = rows.rows.map(r => JSON.parse(String(r.payload)) as ClassificationPacket);
    const first = chunks[0];
    images.push({ missionId: first.missionId, imageId: first.imageId, gps: first.gps, columns: first.columns, ...assembleImage(chunks) });
  }
  return {
    latestTelemetry: latest.rows.length ? { receivedAt: String(latest.rows[0].received_at), packet: JSON.parse(String(latest.rows[0].payload)) as FlightPacket } : null,
    recent: recent.rows.map(r => ({ id: Number(r.id), receivedAt: String(r.received_at), packet: JSON.parse(String(r.payload)) as FlightPacket })),
    images,
  };
}
export type GroundSnapshot = Awaited<ReturnType<typeof getGroundSnapshot>>;
