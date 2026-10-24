'use client';
import { useEffect, useRef, useState } from 'react';
import { WifiLink, type GatewayStatus } from '@/lib/ground/wifi';
import { SerialLink } from '@/lib/ground/serial';
import { commandSchema, parsePacket, MODES, SOURCE_NAMES } from '@/lib/ground/protocol';
import type { GroundSnapshot } from '@/lib/ground/store';
import { demoPackets } from '@/lib/ground/demo';
import BackupReceivers from './BackupReceivers';
import OperationsReference from './OperationsReference';
import { Button } from '@/components/ui/button';

export const CLASS_COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
export default function GroundStation({ preview = false }: { preview?: boolean }) {
  const link = useRef<SerialLink | WifiLink | null>(null);
  const [connection, setConnection] = useState('Disconnected');
  const [baud, setBaud] = useState(115200);
  const [transport, setTransport] = useState('wifi');
  const [address, setAddress] = useState('ws://192.168.4.1:81/');
  const [token, setToken] = useState('');
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [snapshot, setSnapshot] = useState<GroundSnapshot | null>(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);
  const [missionId, setMissionId] = useState('');
  const [mode, setMode] = useState('safe');
  const [commandType, setCommandType] = useState('set_mode');
  const [target, setTarget] = useState('telemetry');
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
    setConnection('Connecting'); setGateway(null);
    const onClose = () => { setConnection('Disconnected'); setEnabled(false); setGateway(null); };
    const onError = (message: string) => log(`ERROR: ${message}`);
    const onLine = async (line: string) => ingest(JSON.parse(line));
    try {
      if (transport === 'wifi') {
        const wifi = new WifiLink(); link.current = wifi;
        await wifi.connect(address, token, onLine, onError, onClose, setGateway);
      } else {
        const serial = new SerialLink(); link.current = serial;
        await serial.connect(baud, onLine, onError, onClose);
      }
      setConnection('Connected');
    } catch (e) { log((e as Error).message); await link.current?.disconnect(); onClose(); }
  }
  async function runDemo() {
    setDemo(true);
    try { for (const packet of demoPackets()) await ingest(packet); }
    catch (e) { log((e as Error).message); }
    finally { setDemo(false); }
  }
  async function sendCommand() {
    if (preview) return;
    setSending(true);
    try {
      const value = commandSchema.parse({ version: 1, type: commandType, missionId, commandId: crypto.randomUUID(), timestamp: new Date().toISOString(), ...(commandType === 'set_mode' ? { mode } : { target }) });
      if (!link.current) throw new Error('No ground receiver connection');
      await link.current.send(value);
      setCommand({ id: value.commandId, mission: value.missionId, message: 'Submitted to the ground receiver; awaiting balloon acknowledgement. No automatic retry.' });
      log(`TX ${value.type}: ${value.commandId}`);
    } catch (e) { log((e as Error).message); }
    finally { setSending(false); }
  }
  const telemetry = snapshot?.latestTelemetry;
  const ack = snapshot?.recent.find(r => (r.source === 'main_lora' || r.source === 'wired') && r.packet.type === 'command_ack' && r.packet.commandId === command?.id && r.packet.missionId === command?.mission)?.packet;
  return <section className="space-y-4 rounded-xl border p-5 col-span-2" aria-label="Ground station connection">
    <h2 className="text-xl font-semibold">SYNAPSE — Balloon link and received data</h2>
    {preview && <p className="rounded border border-amber-500 bg-amber-100 text-black p-3"><strong>PREVIEW MODE</strong> — separate preview.db database. Radio commands are disabled. Click Load demo packets to explore.</p>}
    <p>Balloon → LoRa radio → ground receiver → Wi-Fi or local USB → laptop. No cable runs to the balloon. Receiver connection and balloon reception are separate statuses.</p>
    <div className="flex flex-wrap gap-3 items-center">
      <label>Ground receiver connection <select value={transport} disabled={connection !== 'Disconnected'} onChange={e => setTransport(e.target.value)}><option value="wifi">Wi-Fi</option><option value="usb">USB to ground receiver</option></select></label>
      {transport === 'wifi' ? <><label>Receiver address <input className="border p-1" value={address} disabled={connection !== 'Disconnected'} onChange={e => setAddress(e.target.value)} /></label><label>Gateway token <input className="border p-1" type="password" autoComplete="off" value={token} disabled={connection !== 'Disconnected'} onChange={e => setToken(e.target.value)} /></label></> : <label>USB baud rate <select value={baud} disabled={connection !== 'Disconnected'} onChange={e => setBaud(Number(e.target.value))}>{[9600, 57600, 115200, 230400].map(n => <option key={n}>{n}</option>)}</select></label>}
      <Button onClick={connect} disabled={connection !== 'Disconnected' || demo}>Connect ground receiver</Button>
      <Button variant="outline" disabled={connection !== 'Connected'} onClick={async () => { setConnection('Disconnecting'); await link.current?.disconnect(); }}>Disconnect</Button>
      <span role="status">Ground receiver: {connection}</span>
      <Button variant="secondary" disabled={demo || connection !== 'Disconnected'} onClick={runDemo}>{demo ? 'Loading…' : 'Load demo packets (saved as demo)'}</Button>
    </div>
    {gateway && <p>Ground LoRa radio: {gateway.radioReady ? 'Initialized' : 'Unavailable'} • received radio messages: {gateway.receivedPackets} • last RSSI: {gateway.lastRssi ?? 'none'} dBm. This is receiver status, not confirmation of a live balloon.</p>}
    <BackupReceivers snapshot={snapshot} ingest={ingest} />
    <OperationsReference />
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {telemetry && telemetry.packet.type === 'telemetry' ? <div>
      <h3 className="font-semibold">Latest telemetry — {telemetry.packet.missionId.startsWith('demo-') ? 'DEMO' : 'RECEIVED'} — {telemetry.packet.missionId}</h3>
      <p>Received {telemetry.receivedAt} • age {Math.max(0, Math.floor((now - Date.parse(telemetry.receivedAt)) / 1000))} s • averaging window {telemetry.packet.averagingWindowSeconds} s</p>
      <p>Mode: {telemetry.packet.obc.mode} • Phase: {telemetry.packet.obc.flightPhase} • Battery: {telemetry.packet.obc.batteryVoltageV ?? 'unavailable'} V</p>
      <details><summary>All sensor and internal parameters</summary><pre className="text-xs whitespace-pre-wrap overflow-auto">{JSON.stringify(telemetry.packet, null, 2)}</pre></details>
    </div> : <p>No telemetry received yet.</p>}
    {snapshot?.latestState?.packet.type === 'state' && <p><strong>Last reported state:</strong> {snapshot.latestState.packet.mode} / {snapshot.latestState.packet.flightPhase} — {snapshot.latestState.packet.reason} ({snapshot.latestState.packet.missionId}, {snapshot.latestState.packet.timestamp})</p>}
    {telemetry?.packet.type === 'telemetry' && <div className="grid gap-2 sm:grid-cols-2">
      <p>Interior min/max (°C): {telemetry.packet.interiorTemperatureExtremaC?.map((r, i) => `Sensor ${i + 1}: ${r ? `${r.min} / ${r.max}` : 'unavailable'}`).join('; ') ?? 'Not reported'}</p>
      <p>Current min/max (A): {telemetry.packet.currentExtremaA ? `${telemetry.packet.currentExtremaA.min} / ${telemetry.packet.currentExtremaA.max}` : 'Not reported'}</p>
    </div>}
    <details><summary>Experimental commands (requires matching firmware)</summary>
      <div className="flex flex-wrap gap-3 my-3 items-center">
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> I confirmed the command contract with the firmware team</label>
        <label>Mission ID <input className="border p-1" value={missionId} onChange={e => setMissionId(e.target.value)} /></label>
        <label>Command <select value={commandType} onChange={e => setCommandType(e.target.value)}><option value="set_mode">Change operational mode</option><option value="request_data">Request data (proposed)</option></select></label>
        {commandType === 'set_mode' ? <label>Mode <select value={mode} onChange={e => setMode(e.target.value)}>{MODES.map(m => <option key={m}>{m}</option>)}</select></label> : <label>Data <select value={target} onChange={e => setTarget(e.target.value)}>{['telemetry', 'classification', 'status', 'critical_logs'].map(t => <option key={t}>{t}</option>)}</select></label>}
        <Button disabled={preview || !enabled || connection !== 'Connected' || (transport === 'wifi' && !gateway?.radioReady) || !missionId || sending} onClick={sendCommand}>Send command</Button>
      </div>
      {command && <p>Command {command.id}: {ack?.type === 'command_ack' ? `${ack.status}: ${ack.message}` : command.message}</p>}
    </details>
    <h3 className="font-semibold">Classification images (latest 20)</h3>
    <p>Class IDs 0–9; label names and geographic tile footprints await payload metadata. Missing tiles remain blank.</p>
    <div className="flex flex-wrap gap-4">{snapshot?.images.map(image => <div className="border rounded p-3 max-w-md" key={`${image.source}:${image.missionId}:${image.imageId}`}>
      <p className="break-all">{image.missionId} / {image.imageId}</p>
      <p>{image.received}/{image.totalSegments} segments — {image.complete ? 'Complete' : 'Incomplete'}</p>
      <p>GPS: {image.gps.latitude}, {image.gps.longitude}</p>
      {image.columns ? <div aria-label="Classification grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${image.columns}, 1fr)`, width: 312, maxWidth: '100%' }}>
        {image.labels.map((label, i) => <div key={i} title={`Segment ${i}: ${label === null ? 'missing' : `class ${label}`}`} style={{ aspectRatio: 1, background: label === null ? '#777' : CLASS_COLORS[label], opacity: label === null ? 0.2 : 1 }} />)}
      </div> : <p>Grid dimensions unspecified; labels stored in segment order.</p>}
    </div>)}</div>
    <h3 className="font-semibold">GPS + single-label classification packets</h3>
    {snapshot?.pointProgress.map(p => <p key={`${p.source}:${p.missionId}:${p.imageId}`}>{SOURCE_NAMES[p.source]} • {p.missionId} / {p.imageId}: {p.received}/{p.totalSegments} tiles received</p>)}
    <p className="text-sm">The latest 200 point locations appear on the map; all accepted points remain stored.</p>
    <h3 className="font-semibold">System events (latest 50)</h3>
    <div className="max-h-52 overflow-auto">{snapshot?.logs.map(row => row.packet.type === 'system_log' && <p className={row.packet.severity === 'critical' ? 'text-red-600 font-semibold' : ''} key={row.id}>{row.packet.timestamp} • {row.packet.missionId} • {row.packet.severity.toUpperCase()} • {row.packet.subsystem}: {row.packet.message}</p>)}</div>
    <details><summary>Received packet log (latest 100)</summary><div className="max-h-80 overflow-auto">{snapshot?.recent.map(r => <details key={r.id}><summary>{r.receivedAt} — {SOURCE_NAMES[r.source]} — {r.packet.type} — {r.packet.packetId}</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.packet, null, 2)}</pre></details>)}</div></details>
    <details open><summary>Connection events / rejected packets</summary><pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto" aria-live="polite">{events.join('\n') || 'No events yet.'}</pre></details>
  </section>;
}
