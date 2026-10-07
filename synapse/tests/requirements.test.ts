import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { demoPackets } from '../lib/ground/demo';
import { parsePacket, assembleImage, commandSchema, type ClassificationPacket } from '../lib/ground/protocol';
import { initializeGroundStore, savePacket, getGroundSnapshot } from '../lib/ground/store';

test('spreadsheet extrema and additional modes are validated', () => {
  const packet = demoPackets()[0];
  assert.throws(() => parsePacket({ ...packet, currentExtremaA: { min: 2, max: 1 } }));
  assert.throws(() => parsePacket({ ...packet, interiorTemperatureExtremaC: [{ min: 1, max: 2 }] }));
  for (const mode of ['photo', 'processing', 'transmission']) {
    assert.ok(commandSchema.parse({ version: 1, type: 'set_mode', commandId: 'test', missionId: 'test', timestamp: packet.timestamp, mode }));
  }
  assert.ok(commandSchema.parse({ version: 1, type: 'request_data', commandId: 'test', missionId: 'test', timestamp: packet.timestamp, target: 'critical_logs' }));
});
test('image sizes 2028, 2961 and 3000 are explicit; no silent truncation', () => {
  const example = demoPackets().find(p => p.type === 'classification')!;
  for (const totalSegments of [2028, 2961, 3000]) {
    const chunks: ClassificationPacket[] = [];
    for (let offset = 0; offset < totalSegments; offset += 128) {
      const count = Math.min(128, totalSegments - offset);
      const { columns: _columns, ...base } = example;
      void _columns;
      chunks.push(parsePacket({ ...base, totalSegments, segmentOffset: offset, segmentCount: count, labelsHex: '0'.repeat(Math.ceil(count / 2) * 2) }) as ClassificationPacket);
    }
    const image = assembleImage(chunks.reverse());
    assert.equal(image.received, totalSegments); assert.equal(image.complete, true);
    assert.equal(image.labels.length, totalSegments);
  }
  assert.throws(() => parsePacket({ ...example, totalSegments: 2961, columns: 52 }));
});
test('backup sources are required, source identities remain separate, and point/log/state packets persist', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'synapse-sources-'));
  const db = createClient({ url: `file:${join(directory, 'packets.db')}` });
  try {
    await initializeGroundStore(db);
    const packets = demoPackets();
    const gsm = packets.find(p => p.type === 'gps_backup' && p.source === 'gsm')!;
    assert.throws(() => parsePacket({ ...gsm, source: 'main_lora' }));
    await savePacket(db, gsm);
    await savePacket(db, { ...gsm, source: 'tinygs' });
    for (const packet of packets.filter(p => ['classification_point', 'system_log', 'state'].includes(p.type))) await savePacket(db, packet);
    const point = packets.find(p => p.type === 'classification_point')!;
    assert.equal((await savePacket(db, { ...point, packetId: 'same-point-new-packet' })).duplicate, true);
    await assert.rejects(savePacket(db, { ...point, packetId: 'bad-point', classId: 7 }), /Conflicting/);
    const result = await getGroundSnapshot(db);
    assert.equal(result.sources.find(s => s.source === 'gsm')?.count, 1);
    assert.equal(result.sources.find(s => s.source === 'tinygs')?.count, 1);
    assert.equal(result.pointProgress[0].received, 1);
    assert.equal(result.pointProgress[0].totalSegments, 2961);
    assert.equal(result.logs.length, 1); assert.ok(result.latestState);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('existing first-version database migrates without duplication or loss', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'synapse-migrate-'));
  const db = createClient({ url: `file:${join(directory, 'packets.db')}` });
  try {
    await initializeGroundStore(db);
    const { source: _source, ...legacy } = demoPackets()[0]; void _source;
    await db.execute({ sql: 'INSERT INTO flight_packets(mission_id,packet_id,type,received_at,payload) VALUES (?,?,?,?,?)', args: [legacy.missionId, legacy.packetId, legacy.type, legacy.timestamp, JSON.stringify(legacy)] });
    await initializeGroundStore(db); await initializeGroundStore(db);
    const result = await getGroundSnapshot(db);
    assert.equal(result.recent.length, 1); assert.equal(result.recent[0].source, 'main_lora');
    assert.equal((await savePacket(db, legacy)).duplicate, true);
    assert.equal((await db.execute('SELECT COUNT(*) AS count FROM flight_packets')).rows[0].count, 1);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
