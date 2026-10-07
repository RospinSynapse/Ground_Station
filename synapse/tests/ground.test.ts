import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { LineDecoder, MAX_LINE, assembleImage, parsePacket, unpackLabels, type ClassificationPacket } from '../lib/ground/protocol';
import { demoPackets } from '../lib/ground/demo';
import { getGroundSnapshot, initializeGroundStore, savePacket } from '../lib/ground/store';

test('all documented telemetry groups survive validation; missing and invalid values rejected', () => {
  const packet = demoPackets()[0];
  assert.deepEqual(parsePacket(packet), packet);
  assert.throws(() => parsePacket({ ...packet, lightLux: '123' }));
  assert.throws(() => parsePacket({ ...packet, gps: { latitude: 91, longitude: 0, altitudeM: null } }));
  assert.throws(() => parsePacket({ ...packet, pressureHpa: undefined }));
  assert.throws(() => parsePacket({ ...packet, type: 'unknown' }));
  assert.throws(() => parsePacket({ ...packet, version: 2 }));
});
test('packed labels have validated counts, IDs and padding', () => {
  assert.deepEqual(unpackLabels('0190', 3), [0, 1, 9]);
  assert.throws(() => unpackLabels('0191', 3));
  assert.throws(() => unpackLabels('fa', 2));
  assert.throws(() => unpackLabels('0', 2));
  const packet = demoPackets()[1];
  assert.throws(() => parsePacket({ ...packet, segmentOffset: 2027, segmentCount: 2, labelsHex: '00' }));
});
test('framing handles split reads, CRLF, multiple lines and oversized input recovery', () => {
  const decoder = new LineDecoder();
  assert.deepEqual(decoder.push('{"x":').lines, []);
  assert.deepEqual(decoder.push('1}\r\n{}\n\n').lines, ['{"x":1}', '{}']);
  assert.equal(decoder.push('x'.repeat(MAX_LINE + 1)).errors.length, 1);
  assert.deepEqual(decoder.push('ignored\n{}\n').lines, ['{}']);
});
test('classification reassembly handles reordered/duplicate fragments and missing tiles', () => {
  const chunks = demoPackets().filter(p => p.type === 'classification') as ClassificationPacket[];
  assert.equal(assembleImage([...chunks].reverse()).received, 2028);
  assert.equal(assembleImage([...chunks, chunks[0]]).received, 2028);
  assert.equal(assembleImage(chunks.slice(1)).complete, false);
  assert.throws(() => assembleImage([chunks[0], { ...chunks[0], labelsHex: '1'.repeat(128) }]));
  assert.throws(() => assembleImage([chunks[0], { ...chunks[1], gps: { ...chunks[1].gps, latitude: 0 } }]));
});
test('database ingestion is idempotent, rejects conflicts, persists partial images and separates missions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'synapse-test-'));
  const url = `file:${join(directory, 'packets.db')}`;
  const db = createClient({ url });
  try {
    await initializeGroundStore(db);
    const packets = demoPackets();
    for (const packet of [...packets].reverse()) await savePacket(db, packet);
    assert.equal((await savePacket(db, packets[0])).duplicate, true);
    await assert.rejects(savePacket(db, { ...packets[0], lightLux: 0 }), /reused/);
    const chunk = packets[1] as ClassificationPacket;
    await assert.rejects(savePacket(db, { ...chunk, packetId: 'conflict', labelsHex: '1'.repeat(128) }), /Conflicting/);
    await savePacket(db, { ...chunk, missionId: 'another-flight' });
    const snapshot = await getGroundSnapshot(db);
    assert.equal(snapshot.images.length, 2);
    assert.equal(snapshot.images[0].received, 128);
    assert.equal(snapshot.images[1].complete, true);
    assert.equal(snapshot.recent.length, packets.length + 1);
    assert.ok(snapshot.latestTelemetry);
    const reopened = createClient({ url });
    try { assert.equal((await getGroundSnapshot(reopened)).images[1].complete, true); }
    finally { reopened.close(); }
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
