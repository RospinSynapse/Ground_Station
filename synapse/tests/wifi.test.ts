import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WifiLink, gatewayUrl } from '../lib/ground/wifi';
class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen?: () => void;
  onerror?: () => void;
  onclose?: () => void;
  onmessage?: (e: {data: string}) => void;
  constructor(public url: string, public protocol: string) { Socket.latest = this; }
  send(text: string) { this.sent.push(text); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(value: unknown) { this.onmessage?.({data: JSON.stringify(value)}); }
}
test('gateway address validates the websocket scheme', () => {
  assert.equal(gatewayUrl('ws://192.168.4.1:81'), 'ws://192.168.4.1:81/');
  assert.throws(() => gatewayUrl('https://example.com'));
  assert.throws(() => gatewayUrl('ws://user:password@localhost'));
});
test('Wi-Fi authenticates, receives in order and submits commands without claiming radio execution', async () => {
  const original = globalThis.WebSocket;
  Object.assign(globalThis, {WebSocket: Socket});
  const link = new WifiLink(); const lines: unknown[] = [], errors: string[] = [];
  let closed = false;
  try {
    const ready = link.connect('ws://192.168.4.1:81', 'test-token', async line => { lines.push(JSON.parse(line)); }, message => errors.push(message), () => { closed = true; }, () => {});
    const socket = Socket.latest; socket.onopen?.();
    assert.deepEqual(JSON.parse(socket.sent[0]), {type:'gateway_auth',token:'test-token'});
    socket.receive({type:'gateway_status',authenticated:true,radioReady:true,receivedPackets:0,lastRssi:null});
    await ready;
    socket.receive({packetId:'1'}); socket.receive({packetId:'2'});
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(lines, [{packetId:'1'},{packetId:'2'}]);
    const command = {version:1,type:'set_mode',missionId:'test',commandId:'cmd-1',timestamp:'2026-10-16T12:00:00Z',mode:'safe'};
    await link.send(command);
    assert.deepEqual(JSON.parse(socket.sent[1]), {type:'gateway_tx',packet:command});
    socket.receive({type:'gateway_error',message:'Radio busy'});
    assert.deepEqual(errors, ['Radio busy']);
    await link.disconnect(); assert.ok(closed);
    await assert.rejects(link.send(command), /disconnected/);
  } finally { await link.disconnect(); Object.assign(globalThis, {WebSocket:original}); }
});
test('Wi-Fi connection rejects a closed unauthenticated gateway', async () => {
  const original = globalThis.WebSocket; Object.assign(globalThis, {WebSocket:Socket});
  const link = new WifiLink();
  try {
    const ready = link.connect('ws://localhost:81', 'bad-token', async () => {}, () => {}, () => {}, () => {});
    Socket.latest.close(); await assert.rejects(ready, /closed/);
  } finally { await link.disconnect(); Object.assign(globalThis, {WebSocket:original}); }
});
