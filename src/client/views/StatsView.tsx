// A running container's use, live: CPU and memory with charts of the last
// minute's readings, network and disk I/O, processes.

import { useEffect, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import type { Stats } from '../../shared/index.ts';
import { ID } from '../lib/calls.ts';
import { Loading } from '../ui/controls.tsx';

/** A line chart of the last readings, 0 to `max` (or the highest). */
function Spark({ values, max, color }: { values: number[]; max?: number; color: string }) {
  const w = 240;
  const h = 48;
  const top = Math.max(max ?? 0, ...values, 1);
  const pts = values.map((v, i) => `${(i / Math.max(1, 59)) * w},${h - (v / top) * (h - 2) - 1}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
      {pts.length > 1 && (
        <>
          <polyline points={`0,${h} ${pts.join(' ')} ${(values.length - 1) * (w / 59)},${h}`} fill={color} fillOpacity={0.15} stroke="none" />
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

export function StatsView({ target, id }: { target: string; id: string }) {
  const host = useHost();
  const [samples, setSamples] = useState<Stats[]>([]);
  const [ended, setEnded] = useState<string | null>(null);
  useEffect(() => {
    setSamples([]);
    return host.subscribe<{ stats: Stats }>(ID, { op: 'stats', target, id }, (e) => setSamples((s) => [...s, e.stats].slice(-60)), {
      onEnd: (e) => setEnded(e ?? null),
    });
  }, [host, target, id]);
  const last = samples.at(-1);
  if (!last) return <Loading error={ended ?? undefined}>Reading its use… (only while it runs)</Loading>;
  const card = (title: string, value: string, chart?: React.ReactNode) => (
    <div className="rounded-md border border-[var(--node-border)] p-2">
      <div className="text-[var(--node-muted)]">{title}</div>
      <div className="text-sm font-medium">{value}</div>
      {chart}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2 overflow-auto p-3">
      {card('CPU', `${last.cpu.toFixed(1)}%`, <Spark values={samples.map((s) => s.cpu)} max={100} color="var(--ansi-4)" />)}
      {card('Memory', `${last.memUsage} (${last.mem.toFixed(1)}%)`, <Spark values={samples.map((s) => s.mem)} max={100} color="var(--ansi-5)" />)}
      {card('Network in / out', last.netIO || '—')}
      {card('Disk read / write', last.blockIO || '—')}
      {card('Processes', last.pids || '—')}
    </div>
  );
}
