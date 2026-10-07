'use client';
import { useEffect, useRef, useState } from 'react';
import { SerialLink } from '@/lib/ground/serial';
import { commandSchema, parsePacket } from '@/lib/ground/protocol';
import type { GroundSnapshot } from '@/lib/ground/store';
import { demoPackets } from '@/lib/ground/demo';
import { Button } from '@/components/ui/button';

export const CLASS_COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
export default function GroundStation() {
  const link = useRef<SerialLink | null>(null);
  const [connection, setConnection] = useState('Disconnected');
  const [baud, setBaud] = useState(115200);
  const [snapshot, setSnapshot] = useState<GroundSnapshot | null>(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);
  const [missionId, setMissionId] = useState('');
  const [mode, setMode] = useState('safe');
  const [enabled, setEnabled] = useState(false);
  const [command, setCommand] = useState<{ id: string; mission: string; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(0);
  const log = (message: string) => setEvents(old => [`${new Date().toLocaleTimeString()} ${message}`, ...old].slice(0, 12));
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch('/api/ground', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
        if (!response.ok) throw new Error('Cannot load packet database');
        const result = await response.json();
        if (!stopped) { setSnapshot(result); setError(''); setNow(Date.now()); }
      } catch (e) { if (!stopped) setError((e as Error).message); }
      finally { if (!stopped) timer = setTimeout(poll, 2000); }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); void link.current?.disconnect(); };
  }, []);
  async function ingest(value: unknown) {
    const packet = parsePacket(value);
    const response = await fetch('/api/ground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(packet), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Packet not stored');
    log(`${result.duplicate ? 'Duplicate' : 'Stored'} ${packet.type}: ${packet.packetId}`);
  }
  async function connect() {
    setConnection('Connecting');
    const serial = new SerialLink(); link.current = serial;
    try {
      await serial.connect(baud, async line => ingest(JSON.parse(line)), message => log(`ERROR: ${message}`), () => { setConnection('Disconnected'); setEnabled(false); });
      setConnection('Connected');
    } catch (e) { log((e as Error).message); setConnection('Disconnected'); }
  }
  async function runDemo() {
    setDemo(true);
    try { for (const packet of demoPackets()) await ingest(packet); }
    catch (e) { log((e as Error).message); }
    finally { setDemo(false); }
  }
  async function sendCommand() {
    setSending(true);
    try {
      const value = commandSchema.parse({ version: 1, type: 'set_mode', missionId, commandId: crypto.randomUUID(), timestamp: new Date().toISOString(), mode });
      if (!link.current) throw new Error('No serial connection');
      await link.current.send(value);
      setCommand({ id: value.commandId, mission: value.missionId, message: 'Written to USB; awaiting balloon acknowledgement. No automatic retry.' });
      log(`TX set_mode ${mode}: ${value.commandId}`);
    } catch (e) { log((e as Error).message); }
    finally { setSending(false); }
  }
  const telemetry = snapshot?.latestTelemetry;
  const ack = snapshot?.recent.find(r => r.packet.type === 'command_ack' && r.packet.commandId === command?.id && r.packet.missionId === command?.mission)?.packet;
  return <section className="space-y-4 rounded-xl border p-5 col-span-2" aria-label="Ground station connection">
    <h2 className="text-xl font-semibold">Balloon link and received data</h2>
    <p>Proposed USB bridge v1 — flight firmware must implement this contract. USB connected does not mean the radio link is working.</p>
    <div className="flex flex-wrap gap-3 items-center">
      <label>USB baud rate <select value={baud} disabled={connection !== 'Disconnected'} onChange={e => setBaud(Number(e.target.value))}>{[9600, 57600, 115200, 230400].map(n => <option key={n}>{n}</option>)}</select></label>
      <Button onClick={connect} disabled={connection !== 'Disconnected' || demo}>Connect ESP32</Button>
      <Button variant="outline" disabled={connection !== 'Connected'} onClick={async () => { setConnection('Disconnecting'); await link.current?.disconnect(); }}>Disconnect</Button>
      <span role="status">USB: {connection}</span>
      <Button variant="secondary" disabled={demo || connection !== 'Disconnected'} onClick={runDemo}>{demo ? 'Loading…' : 'Load demo packets (saved as demo)'}</Button>
    </div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {telemetry && telemetry.packet.type === 'telemetry' ? <div>
      <h3 className="font-semibold">Latest telemetry — {telemetry.packet.missionId.startsWith('demo-') ? 'DEMO' : 'RECEIVED'} — {telemetry.packet.missionId}</h3>
      <p>Received {telemetry.receivedAt} • age {Math.max(0, Math.floor((now - Date.parse(telemetry.receivedAt)) / 1000))} s • averaging window {telemetry.packet.averagingWindowSeconds} s</p>
      <p>Mode: {telemetry.packet.obc.mode} • Phase: {telemetry.packet.obc.flightPhase} • Battery: {telemetry.packet.obc.batteryVoltageV ?? 'unavailable'} V</p>
      <details><summary>All sensor and internal parameters</summary><pre className="text-xs whitespace-pre-wrap overflow-auto">{JSON.stringify(telemetry.packet, null, 2)}</pre></details>
    </div> : <p>No telemetry received yet.</p>}
    <details><summary>Experimental mode command (requires matching firmware)</summary>
      <div className="flex flex-wrap gap-3 my-3 items-center">
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> I confirmed the command contract with the firmware team</label>
        <label>Mission ID <input className="border p-1" value={missionId} onChange={e => setMissionId(e.target.value)} /></label>
        <label>Mode <select value={mode} onChange={e => setMode(e.target.value)}>{['init', 'nominal', 'low_power', 'safe', 'recovery'].map(m => <option key={m}>{m}</option>)}</select></label>
        <Button disabled={!enabled || connection !== 'Connected' || !missionId || sending} onClick={sendCommand}>Send mode command</Button>
      </div>
      {command && <p>Command {command.id}: {ack?.type === 'command_ack' ? `${ack.status}: ${ack.message}` : command.message}</p>}
    </details>
    <h3 className="font-semibold">Classification images (latest 20)</h3>
    <p>Class IDs 0–9; label names and geographic tile footprints await payload metadata. Missing tiles remain blank.</p>
    <div className="flex flex-wrap gap-4">{snapshot?.images.map(image => <div className="border rounded p-3 max-w-md" key={`${image.missionId}:${image.imageId}`}>
      <p className="break-all">{image.missionId} / {image.imageId}</p>
      <p>{image.received}/2028 segments — {image.complete ? 'Complete' : 'Incomplete'}</p>
      <p>GPS: {image.gps.latitude}, {image.gps.longitude}</p>
      {image.columns ? <div aria-label="Classification grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${image.columns}, 1fr)`, width: 312, maxWidth: '100%' }}>
        {image.labels.map((label, i) => <div key={i} title={`Segment ${i}: ${label === null ? 'missing' : `class ${label}`}`} style={{ aspectRatio: 1, background: label === null ? '#777' : CLASS_COLORS[label], opacity: label === null ? 0.2 : 1 }} />)}
      </div> : <p>Grid dimensions unspecified; labels stored in segment order.</p>}
    </div>)}</div>
    <details><summary>Received packet log (latest 100)</summary><div className="max-h-80 overflow-auto">{snapshot?.recent.map(r => <details key={r.id}><summary>{r.receivedAt} — {r.packet.type} — {r.packet.packetId}</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.packet, null, 2)}</pre></details>)}</div></details>
    <details open><summary>Connection events / rejected packets</summary><pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto" aria-live="polite">{events.join('\n') || 'No events yet.'}</pre></details>
  </section>;
}
