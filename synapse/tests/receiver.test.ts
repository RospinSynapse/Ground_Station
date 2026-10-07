import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoPackets } from '../lib/ground/demo';
import { SerialLink } from '../lib/ground/serial';

test('HTTP ingestion rejects bad input and preserves a valid packet through GET', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'synapse-api-'));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, 'packets.db')}`;
  const { GET, POST } = await import('../app/api/ground/route');
  const { client } = await import('../src/db');
  const request = (body: string, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/ground', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
  try {
    const packet = JSON.stringify(demoPackets()[0]);
    assert.equal((await POST(request(packet, 'http://other.example'))).status, 403);
    assert.equal((await POST(request('{'))).status, 400);
    assert.equal((await POST(request('{}'))).status, 400);
    assert.equal((await POST(request('x'.repeat(32769)))).status, 413);
    assert.equal((await POST(request(packet))).status, 201);
    assert.equal((await POST(request(packet))).status, 200);
    const result = await GET();
    assert.equal(result.status, 200);
    assert.equal((await result.json()).recent.length, 1);
  } finally { client.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('serial connection joins split input, writes newline JSON and releases stream locks', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false, notified = false;
  const writes: string[] = [], errors: string[] = [], lines: string[] = [];
  const port = {
    readable: new ReadableStream<Uint8Array>({ start(c) { controller = c; } }),
    writable: new WritableStream<Uint8Array>({ write(chunk) { writes.push(new TextDecoder().decode(chunk)); } }),
    async open(options: { baudRate: number }) { assert.equal(options.baudRate, 115200); },
    async close() { assert.equal(this.readable.locked, false); assert.equal(this.writable.locked, false); closed = true; },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serial: { async requestPort() { return port; } } } });
  const serial = new SerialLink();
  let received!: () => void;
  const complete = new Promise<void>(resolve => { received = resolve; });
  try {
    await serial.connect(115200, async line => { lines.push(line); if (lines.length === 2) received(); }, error => errors.push(error), () => { notified = true; });
    controller.enqueue(new TextEncoder().encode('{"a":'));
    controller.enqueue(new TextEncoder().encode('1}\n{}\n'));
    await complete;
    await serial.send({ type: 'test' });
    await serial.disconnect();
    assert.deepEqual(lines, ['{"a":1}', '{}']);
    assert.deepEqual(writes, ['{"type":"test"}\n']);
    assert.deepEqual(errors, []);
    assert.ok(closed && notified);
    await assert.rejects(serial.send({}), /No connected/);
  } finally {
    await serial.disconnect();
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
