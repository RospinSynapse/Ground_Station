'use client';
import { useEffect, useState } from 'react';
import type { GroundSnapshot } from '@/lib/ground/store';
import { SOURCE_NAMES } from '@/lib/ground/protocol';
import { getPackets } from '@/app/actions';
import type { Packet } from '@/lib/utils';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PacketDisplay() {
  const [received, setReceived] = useState<GroundSnapshot['recent']>([]);
  const [manual, setManual] = useState<Packet[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [response, legacy] = await Promise.all([fetch('/api/ground', { cache: 'no-store', signal: AbortSignal.timeout(10000) }), getPackets()]);
        if (!response.ok) throw new Error('Packet storage unavailable');
        const snapshot: GroundSnapshot = await response.json();
        if (!stopped) { setReceived(snapshot.recent); setManual(legacy); setError(''); }
      } catch (e) { if (!stopped) setError((e as Error).message); }
      finally { if (!stopped) timer = setTimeout(refresh, 2000); }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return <>
    {error && <p role="alert">{error}</p>}
    <Table>
      <TableCaption>Latest 100 received packets and legacy manual entries</TableCaption>
      <TableHeader><TableRow>{['ID', 'Type', 'Source / mission', 'Time received', 'Details'].map(name => <TableHead key={name}>{name}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {received.map(row => <TableRow key={`received-${row.id}`}>
          <TableCell>{row.packet.packetId}</TableCell><TableCell>{row.packet.type}</TableCell>
          <TableCell>{SOURCE_NAMES[row.source]} / {row.packet.missionId}</TableCell><TableCell>{row.receivedAt}</TableCell>
          <TableCell><details><summary>Details</summary><pre className="whitespace-pre-wrap max-w-xl">{JSON.stringify(row.packet, null, 2)}</pre></details></TableCell>
        </TableRow>)}
        {manual.map((row, i) => <TableRow key={`manual-${i}`}><TableCell>Manual {i + 1}</TableCell><TableCell>{row.type}</TableCell><TableCell>{row.desc}</TableCell><TableCell>{row.time}</TableCell><TableCell><details><summary>Details</summary><pre className="whitespace-pre-wrap max-w-xl">{row.details}</pre></details></TableCell></TableRow>)}
        {!received.length && !manual.length && <TableRow><TableCell colSpan={5}>No packets stored yet. Connect a ground receiver or load demo packets.</TableCell></TableRow>}
      </TableBody>
    </Table>
  </>;
}
