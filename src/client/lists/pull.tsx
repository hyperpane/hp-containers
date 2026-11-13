// Pulling an image: its name asked for, then what the pull prints, in a
// panel over the list until it's closed.

import { useEffect, useState } from 'react';
import { Download, Square } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { ToolButton, cn } from '@hyperpane/ui';
import { ID } from '../lib/calls.ts';
import { Btn } from '../ui/controls.tsx';

export function Pull({ target }: { target: string }) {
  const host = useHost();
  const [image, setImage] = useState<string | null>(null);
  return (
    <>
      <Btn
        icon={Download}
        onClick={async () => {
          const name = await host.ui.prompt({ title: 'Pull an image', label: 'Its name', placeholder: 'nginx:latest, ghcr.io/owner/app:tag' });
          if (name?.trim()) setImage(name.trim());
        }}
      >
        Pull
      </Btn>
      {image && (
        <div className="fixed inset-x-4 bottom-4 z-20 flex h-48 flex-col rounded-lg border border-[var(--node-border)] bg-[var(--node-bg)] shadow-lg">
          <div className="flex items-center px-3 pt-2 font-medium">
            <span className="flex-1">Pulling {image}</span>
            <ToolButton label="Close" icon={Square} onClick={() => setImage(null)} />
          </div>
          <PullLog target={target} image={image} />
        </div>
      )}
    </>
  );
}

function PullLog({ target, image }: { target: string; image: string }) {
  const host = useHost();
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  useEffect(
    () =>
      host.subscribe<{ text: string }>(ID, { op: 'pull', target, image }, (e) => setLines((l) => [...l, ...e.text.split(/\r?\n|\r/).filter(Boolean)].slice(-200)), {
        onEnd: (e) => setDone(e ?? 'Done.'),
      }),
    [host, target, image],
  );
  return (
    <pre className="m-2 min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-4">
      {lines.join('\n')}
      {done && <span className={cn('block', done === 'Done.' ? 'text-[var(--ansi-2)]' : 'text-[var(--ansi-1)]')}>{done}</span>}
    </pre>
  );
}
