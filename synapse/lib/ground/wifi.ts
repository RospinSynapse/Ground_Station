import { MAX_LINE, commandSchema } from './protocol';

export type GatewayStatus = { type: 'gateway_status'; authenticated: boolean; radioReady: boolean; receivedPackets: number; lastRssi: number | null };
export function gatewayUrl(value: string) {
  const url = new URL(value);
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Use a ws:// or wss:// receiver address without credentials');
  return url.toString();
}
export class WifiLink {
  private socket?: WebSocket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastMessage = 0;
  private active = false;
  private generation = 0;
  private queue = Promise.resolve();
  private pending = 0;
  async connect(address: string, token: string, onLine: (line: string) => Promise<void>, onError: (message: string) => void, onClose: () => void, onStatus: (status: GatewayStatus) => void) {
    if (!token) throw new Error('Enter the gateway access token configured on the ground receiver');
    const socket = new WebSocket(gatewayUrl(address), 'arduino');
    this.socket = socket;
    const generation = ++this.generation;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Gateway authentication timed out')); socket.close(); }, 10000);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'gateway_auth', token }));
      socket.onerror = () => { reject(new Error('Cannot reach ground receiver. Check Wi-Fi, address and gateway firmware.')); socket.close(); };
      socket.onclose = () => {
        clearTimeout(timeout); clearInterval(this.heartbeat); this.active = false;
        reject(new Error('Gateway connection closed')); onClose();
      };
      socket.onmessage = event => {
        this.lastMessage = Date.now();
        try {
          if (typeof event.data !== 'string' || new TextEncoder().encode(event.data).length > MAX_LINE) throw new Error('Gateway message too large or not text');
          const value = JSON.parse(event.data);
          if (value.type === 'gateway_error') throw new Error(String(value.message || 'Gateway rejected request'));
          if (value.type === 'gateway_status') {
            if (value.authenticated !== true || typeof value.radioReady !== 'boolean' || !Number.isInteger(value.receivedPackets) || !(value.lastRssi === null || typeof value.lastRssi === 'number')) throw new Error('Invalid gateway status');
            if (!this.active) {
              this.active = true; clearTimeout(timeout);
              this.heartbeat = setInterval(() => { if (Date.now() - this.lastMessage > 20000) { onError('Ground receiver heartbeat lost'); socket.close(); } }, 5000);
              resolve();
            }
            onStatus(value); return;
          }
          if (!this.active) throw new Error('Packet received before gateway authentication');
          if (this.pending >= 128) { onError('Receiver queue full; disconnecting to avoid silent overflow'); socket.close(); return; }
          const line = event.data; this.pending++;
          this.queue = this.queue.then(async () => {
            if (this.generation === generation) await onLine(line);
          }).catch(error => onError((error as Error).message)).finally(() => { this.pending--; });
        } catch (error) { onError((error as Error).message); }
      };
    });
  }
  async send(value: unknown) {
    if (!this.active || this.socket?.readyState !== WebSocket.OPEN) throw new Error('Ground receiver is disconnected');
    const command = commandSchema.parse(value);
    if (this.socket.bufferedAmount > MAX_LINE) throw new Error('Gateway transmit buffer is full');
    this.socket.send(JSON.stringify({ type: 'gateway_tx', packet: command }));
  }
  async disconnect() {
    this.generation++; this.active = false; clearInterval(this.heartbeat);
    this.socket?.close(); await this.queue;
  }
}
