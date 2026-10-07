import { client } from '@/src/db';
import { getGroundSnapshot, initializeGroundStore, PacketConflict, savePacket } from '@/lib/ground/store';
import { MAX_LINE } from '@/lib/ground/protocol';
import { ZodError } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let initialized: Promise<void> | undefined;
async function ready() {
  initialized ??= initializeGroundStore(client).catch(error => { initialized = undefined; throw error; });
  await initialized;
}
export async function GET() {
  try { await ready(); return Response.json(await getGroundSnapshot(client), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error(error); return Response.json({ error: 'Database unavailable' }, { status: 503 }); }
}
export async function POST(request: Request) {
  // Local operator UI only: no cross-origin writes and no secrets exposed to the browser.
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Same-origin request required' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'JSON required' }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Body required' }, { status: 400 });
  let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > MAX_LINE) { await reader.cancel(); return Response.json({ error: 'Packet too large' }, { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    await ready();
    const result = await savePacket(client, input);
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof PacketConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof ZodError) return Response.json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    if (error instanceof Error && /Fragment|Columns|label|padding/.test(error.message)) return Response.json({ error: error.message }, { status: 400 });
    console.error(error); return Response.json({ error: 'Packet storage failed' }, { status: 503 });
  }
}
