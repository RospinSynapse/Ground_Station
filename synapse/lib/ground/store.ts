import type { Client, Row } from '@libsql/client';
import { assembleImage, parsePacket, SOURCES, type PacketSource, type ClassificationPacket, type FlightPacket } from './protocol';

export class PacketConflict extends Error {}
export async function initializeGroundStore(client: Client) {
  // Keep the original table intact and copy its entries idempotently.
  await client.execute(`CREATE TABLE IF NOT EXISTS flight_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL,
    packet_id TEXT NOT NULL, type TEXT NOT NULL, image_id TEXT,
    received_at TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(mission_id, packet_id))`);
  await client.execute(`CREATE TABLE IF NOT EXISTS received_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
    mission_id TEXT NOT NULL, packet_id TEXT NOT NULL, type TEXT NOT NULL,
    image_id TEXT, segment_index INTEGER, received_at TEXT NOT NULL,
    payload TEXT NOT NULL, UNIQUE(source, mission_id, packet_id))`);
  await client.execute('CREATE INDEX IF NOT EXISTS received_image ON received_packets(source, mission_id, image_id)');
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS received_point ON received_packets(source, mission_id, image_id, segment_index) WHERE type='classification_point'`);
  await client.execute(`INSERT OR IGNORE INTO received_packets(source, mission_id, packet_id, type, image_id, received_at, payload)
    SELECT 'main_lora', mission_id, packet_id, type, image_id, received_at, payload FROM flight_packets ORDER BY id`);
}
export async function savePacket(client: Client, input: unknown) {
  const packet = parsePacket(input);
  const source = packet.source ?? 'main_lora';
  const payload = JSON.stringify(packet);
  const imageId = 'imageId' in packet ? packet.imageId : null;
  const tx = await client.transaction('write');
  try {
    const old = await tx.execute({ sql: 'SELECT payload FROM received_packets WHERE source=? AND mission_id=? AND packet_id=?', args: [source, packet.missionId, packet.packetId] });
    if (old.rows.length) {
      if (JSON.stringify(parsePacket(JSON.parse(String(old.rows[0].payload)))) !== payload) throw new PacketConflict('Packet ID reused with different content');
      await tx.commit(); return { duplicate: true };
    }
    if (imageId) {
      const previous = await tx.execute({ sql: 'SELECT payload FROM received_packets WHERE source=? AND mission_id=? AND image_id=? ORDER BY id', args: [source, packet.missionId, imageId] });
      const previousPackets = previous.rows.map(r => JSON.parse(String(r.payload)) as FlightPacket);
      if (previousPackets.some(p => p.type !== packet.type)) throw new PacketConflict('Do not mix grid and point representations for one image ID');
      if (packet.type === 'classification') {
        try { assembleImage([...(previousPackets as ClassificationPacket[]), packet]); }
        catch (error) { throw new PacketConflict((error as Error).message); }
      }
      if (packet.type === 'classification_point') {
        for (const point of previousPackets) {
          if (point.type !== 'classification_point') continue;
          if (point.totalSegments !== packet.totalSegments) throw new PacketConflict('Conflicting image size');
          if (point.segmentIndex === packet.segmentIndex) {
            if (point.classId !== packet.classId || JSON.stringify(point.gps) !== JSON.stringify(packet.gps)) throw new PacketConflict('Conflicting classification point');
            await tx.commit(); return { duplicate: true };
          }
        }
      }
    }
    await tx.execute({ sql: 'INSERT INTO received_packets(source, mission_id, packet_id, type, image_id, segment_index, received_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [source, packet.missionId, packet.packetId, packet.type, imageId, packet.type === 'classification_point' ? packet.segmentIndex : null, new Date().toISOString(), payload] });
    await tx.commit(); return { duplicate: false };
  } finally { tx.close(); }
}
function entry(row: Row) {
  return { id: Number(row.id), source: String(row.source) as PacketSource, receivedAt: String(row.received_at), packet: JSON.parse(String(row.payload)) as FlightPacket };
}
export async function getGroundSnapshot(client: Client) {
  const recent = await client.execute('SELECT * FROM received_packets ORDER BY id DESC LIMIT 100');
  const latest = await client.execute("SELECT * FROM received_packets WHERE type='telemetry' ORDER BY id DESC LIMIT 1");
  const state = await client.execute("SELECT * FROM received_packets WHERE type='state' ORDER BY id DESC LIMIT 1");
  const logs = await client.execute("SELECT * FROM received_packets WHERE type='system_log' ORDER BY id DESC LIMIT 50");
  const keys = await client.execute("SELECT source, mission_id, image_id, MAX(id) AS newest FROM received_packets WHERE type='classification' GROUP BY source, mission_id, image_id ORDER BY newest DESC LIMIT 20");
  const images = [];
  for (const key of keys.rows) {
    const rows = await client.execute({ sql: 'SELECT payload FROM received_packets WHERE source=? AND mission_id=? AND image_id=? ORDER BY id', args: [key.source, key.mission_id, key.image_id] });
    const chunks = rows.rows.map(r => JSON.parse(String(r.payload)) as ClassificationPacket);
    const first = chunks[0];
    images.push({ source: String(key.source) as PacketSource, missionId: first.missionId, imageId: first.imageId, gps: first.gps, columns: first.columns, ...assembleImage(chunks) });
  }
  const pointRows = await client.execute("SELECT * FROM received_packets WHERE type='classification_point' ORDER BY id DESC LIMIT 200");
  const pointImages = await client.execute("SELECT source, mission_id, image_id, COUNT(*) AS received, MAX(id) AS newest FROM received_packets WHERE type='classification_point' GROUP BY source, mission_id, image_id ORDER BY newest DESC LIMIT 20");
  const pointProgress = [];
  for (const key of pointImages.rows) {
    const result = await client.execute({ sql: 'SELECT payload FROM received_packets WHERE id=?', args: [key.newest] });
    const packet = JSON.parse(String(result.rows[0].payload));
    pointProgress.push({ source: String(key.source) as PacketSource, missionId: String(key.mission_id), imageId: String(key.image_id), received: Number(key.received), totalSegments: Number(packet.totalSegments) });
  }
  const sources = [];
  for (const source of SOURCES) {
    const last = await client.execute({ sql: 'SELECT * FROM received_packets WHERE source=? ORDER BY id DESC LIMIT 1', args: [source] });
    const fix = await client.execute({ sql: "SELECT * FROM received_packets WHERE source=? AND type IN ('gps_backup', 'telemetry') AND json_type(payload, '$.gps') = 'object' ORDER BY id DESC LIMIT 1", args: [source] });
    const counts = await client.execute({ sql: 'SELECT COUNT(*) AS count FROM received_packets WHERE source=?', args: [source] });
    sources.push({ source, count: Number(counts.rows[0].count), latest: last.rows.length ? entry(last.rows[0]) : null, position: fix.rows.length ? entry(fix.rows[0]) : null });
  }
  return {
    latestTelemetry: latest.rows.length ? entry(latest.rows[0]) : null,
    latestState: state.rows.length ? entry(state.rows[0]) : null,
    logs: logs.rows.map(entry), recent: recent.rows.map(entry), images, sources,
    points: pointRows.rows.map(entry), pointProgress,
  };
}
export type GroundSnapshot = Awaited<ReturnType<typeof getGroundSnapshot>>;
