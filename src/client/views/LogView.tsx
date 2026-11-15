// A log, followed: a container's, a pod's or a pm2 process's, as the logs
// subscription sends it; searched, copied, cleared, and kept to its end
// while it's scrolled to the bottom.

import { useEffect, useRef, useState } from 'react';
import { Copy, Search, Trash2 } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { Checkbox, NodeInput, ToolButton } from '@hyperpane/ui';
import { ANSI } from '../lib/ansi.ts';
import { ID } from '../lib/calls.ts';

const MAX_LOG = 600_000;

/** A log, followed: what the subscription sends ({ text }). */
export function LogView({ request, timestamps }: { request: Record<string, unknown>; timestamps?: boolean }) {
  const host = useHost();
  const [text, setText] = useState('');
  const [ended, setEnded] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [find, setFind] = useState('');
  const [ts, setTs] = useState(false);
  const box = useRef<HTMLPreElement>(null);
  const key = JSON.stringify(request);
  useEffect(() => {
    setText('');
    setEnded(null);
    return host.subscribe<{ text: string }>(ID, { op: 'logs', ...request, timestamps: ts }, (e) => setText((t) => (t + e.text.replace(ANSI, '')).slice(-MAX_LOG)), {
      onEnd: (e) => setEnded(e ?? 'The log ended'),
    });
  }, [host, key, ts]);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);
  const lines = find ? text.split('\n').filter((l) => l.toLowerCase().includes(find.toLowerCase())) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1.5 left-1.5 size-3 text-[var(--node-muted)]" />
          <NodeInput className="w-full pl-6" placeholder="Show only lines with" value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        {timestamps && (
          <Checkbox className="flex-none gap-1.5 text-xs text-[var(--node-muted)]" label="Times" checked={ts} onCheckedChange={setTs} />
        )}
        <Checkbox className="flex-none gap-1.5 text-xs text-[var(--node-muted)]" label="Follow" checked={follow} onCheckedChange={setFollow} />
        <ToolButton label="Copy the log" icon={Copy} onClick={() => void host.app.clipboardWrite({ text: lines ? lines.join('\n') : text })} />
        <ToolButton label="Clear" icon={Trash2} onClick={() => setText('')} />
      </div>
      <pre
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          setFollow(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
        }}
        className="mx-3 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[var(--node-border)] bg-[color-mix(in_srgb,var(--node-fg)_4%,transparent)] p-2 font-mono text-[11px] leading-4 whitespace-pre-wrap select-text"
      >
        {lines ? lines.join('\n') : text || (!ended && <span className="text-[var(--node-muted)]">Waiting for the log</span>)}
        {ended && <span className="block text-[var(--node-muted)] italic">{ended}</span>}
      </pre>
    </div>
  );
}
