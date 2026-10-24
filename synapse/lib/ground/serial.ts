import { LineDecoder } from './protocol';
interface Port {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
type SerialNavigator = Navigator & { serial?: { requestPort(): Promise<Port> } };
export class SerialLink {
  private port?: Port;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private reading?: Promise<void>;
  private writing?: Promise<void>;
  private stopping = false;
  async connect(baudRate: number, onLine: (line: string) => Promise<void>, onError: (message: string) => void, onClose: () => void) {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) throw new Error('Web Serial unavailable. Use desktop Chrome or Edge on localhost/HTTPS.');
    const port = await serial.requestPort();
    await port.open({ baudRate });
    this.port = port;
    if (this.stopping) { await port.close(); this.port = undefined; return; }
    if (!port.readable) { await port.close(); this.port = undefined; throw new Error('Serial port is not readable'); }
    this.reader = port.readable.getReader();
    const reader = this.reader;
    const decoder = new TextDecoder();
    const framing = new LineDecoder();
    this.reading = (async () => {
      try {
        while (!this.stopping) {
          const { value, done } = await reader.read(); if (done) break;
          const { lines, errors } = framing.push(decoder.decode(value, { stream: true }));
          errors.forEach(onError);
          for (const line of lines) {
            if (this.stopping) break;
            try { await onLine(line); } catch (error) { onError((error as Error).message); }
          }
        }
      } catch (error) { if (!this.stopping) onError((error as Error).message); }
      finally {
        reader.releaseLock(); this.reader = undefined;
        await this.writing?.catch(() => {});
        await port.close().catch(error => onError(String(error)));
        this.port = undefined; onClose();
      }
    })();
  }
  async send(value: unknown) {
    if (this.stopping || !this.port?.writable) throw new Error('No connected serial port');
    if (this.writing) throw new Error('A write is already in progress');
    const writer = this.port.writable.getWriter();
    this.writing = writer.write(new TextEncoder().encode(JSON.stringify(value) + '\n'));
    try { await this.writing; } finally { writer.releaseLock(); this.writing = undefined; }
  }
  async disconnect() {
    this.stopping = true;
    await this.reader?.cancel().catch(() => {});
    await this.reading;
  }
}
