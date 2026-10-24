'use client';
import dynamic from 'next/dynamic';
import type { GroundSnapshot } from '@/lib/ground/store';
import type { Polygon } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getDatapoints } from '@/app/actions';
const Map = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => <p>Loading map…</p> });
export default function MapClient({ initialData }: { initialData: Polygon[] }) {
  const [data, setData] = useState(initialData);
  const [snapshot, setSnapshot] = useState<GroundSnapshot | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [points, response] = await Promise.all([getDatapoints(), fetch('/api/ground', { cache: 'no-store', signal: AbortSignal.timeout(10000) })]);
        const result = response.ok ? await response.json() : null;
        if (!stopped) { setData(points); if (result) setSnapshot(result); }
      } catch (error) { console.error('Map refresh failed', error); }
      finally { if (!stopped) timer = setTimeout(refresh, 2000); }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return <Map initialData={data} images={snapshot?.images ?? []} sources={snapshot?.sources ?? []} points={snapshot?.points ?? []} />;
}
