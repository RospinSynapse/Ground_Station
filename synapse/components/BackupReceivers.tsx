'use client';
import { useEffect, useRef, useState } from 'react';
import { SerialLink } from '@/lib/ground/serial';
import { parsePacket, SOURCE_NAMES, type FlightPacket, type PacketSource } from '@/lib/ground/protocol';
import type { GroundSnapshot } from '@/lib/ground/store';
import { Button } from '@/components/ui/button';

export default function BackupReceivers({ snapshot, ingest }: { snapshot: GroundSnapshot | null; ingest: (input: unknown) => Promise<void> }) {
  const links = useRef<Partial<Record<PacketSource, SerialLink>>>({});
  const [connected, setConnected] = useState<Record<string, string>>({});
  const [baud, setBaud] = useState(115200);
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const sessions = links.current;
    return () => { Object.values(sessions).forEach(link => void link?.disconnect()); };
  }, []);
  async function connect(source: 'gsm' | 'tinygs') {
    const link = new SerialLink(); links.current[source] = link;
    setConnected(old => ({ ...old, [source]: 'Connecting' }));
    try {
      await link.connect(baud, async line => {
        const packet = parsePacket(JSON.parse(line));
        if (packet.source !== source || packet.type !== 'gps_backup') throw new Error(`Expected ${source} gps_backup from this adapter`);
        await ingest(packet);
      }, error => setMessage(error), () => setConnected(old => ({ ...old, [source]: 'Disconnected' })));
      setConnected(old => ({ ...old, [source]: 'Connected' }));
    } catch (error) {
      setMessage((error as Error).message); setConnected(old => ({ ...old, [source]: 'Disconnected' }));
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) { setMessage('Import limited to 1 MiB'); return; }
    setImporting(true); let saved = 0;
    try {
      const text = (await file.text()).trim();
      const parsed: unknown[] = text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      if (!Array.isArray(parsed) || parsed.length > 1000) throw new Error('Import must contain at most 1,000 packets');
      // Validate the whole file before storing any rows. Network failure may still yield partial import.
      const packets: FlightPacket[] = parsed.map(parsePacket);
      for (const packet of packets) { await ingest(packet); saved++; }
      setMessage(`Imported ${saved} packets. Source and mission IDs are preserved.`);
    } catch (error) { setMessage(`Import stopped after ${saved} packets: ${(error as Error).message}`); }
    finally { setImporting(false); }
  }
  return <div className="space-y-3 border rounded-lg p-4">
    <h3 className="font-semibold">Reception sources</h3>
    <p className="text-sm">Main LoRa, GSM and TinyGS are separate paths. Backup adapters below require normalized JSON; they do not configure a SIM modem or subscribe to TinyGS automatically.</p>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(['main_lora', 'gsm', 'tinygs', 'wired'] as const).map(source => {
      const item = snapshot?.sources.find(s => s.source === source);
      const fix = item?.position?.packet;
      const gps = fix && 'gps' in fix ? fix.gps : null;
      return <div className="border rounded p-3 space-y-2" key={source}>
        <h4 className="font-semibold">{SOURCE_NAMES[source]}</h4>
        <p>{item?.count ?? 0} stored packets</p>
        <p className="text-xs break-all">Last receipt: {item?.latest?.receivedAt ?? 'None'}{item?.latest?.packet.missionId.startsWith('demo-') ? ' (DEMO)' : ''}</p>
        {gps && <p className="text-sm">GPS: {gps.latitude}, {gps.longitude}<br />Altitude: {gps.altitudeM ?? 'unknown'} m<br />Fix time: {fix?.timestamp}<br />Mission: {fix?.missionId}</p>}
        {(source === 'gsm' || source === 'tinygs') && <>
          <p className="text-sm">JSON adapter: {connected[source] ?? 'Disconnected'}</p>
          <Button disabled={!!connected[source] && connected[source] !== 'Disconnected'} onClick={() => connect(source)}>Connect adapter</Button>
          <Button variant="outline" disabled={connected[source] !== 'Connected'} onClick={async () => { setConnected(old => ({ ...old, [source]: 'Disconnecting' })); await links.current[source]?.disconnect(); }}>Disconnect</Button>
        </>}
      </div>;
    })}</div>
    <label className="text-sm">Backup adapter baud <select value={baud} onChange={e => setBaud(Number(e.target.value))}>{[9600, 57600, 115200].map(n => <option key={n}>{n}</option>)}</select> (used on next connection)</label>
    <p><a className="underline" href="https://tinygs.com" target="_blank" rel="noreferrer">Open TinyGS dashboard</a> — the separate TinyGS board keeps its own firmware and configuration.</p>
    <label className="block">Import normalized packets (.json array or .jsonl, max 1 MiB)
      <input className="block" type="file" accept=".json,.jsonl" disabled={importing} onChange={e => void importFile(e.target.files?.[0])} />
    </label>
    <p role="status">{importing ? 'Importing…' : message}</p>
  </div>;
}
