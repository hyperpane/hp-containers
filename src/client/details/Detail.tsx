// The page of one thing, opened from a list: its name, state and actions
// at the top, and tabs: a container's Logs, Inspect, Files and Stats; an
// image's Layers, Inspect and Run; a pod's Logs, Describe, Files and
// Inspect; a pm2 process's Logs; a session's Screen.
//
// This is the page's frame: the actions and the header every page has. Each
// thing's page is a file of its own.

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useHost, useProject } from '@hyperpane/sdk/client';
import { ToolButton, cn } from '@hyperpane/ui';
import type { Action, Snapshot, Target } from '../../shared/index.ts';
import { confirmer, useCall } from '../lib/calls.ts';
import type { Open } from '../lib/open.ts';
import { ContainerPage } from './container.tsx';
import { ImagePage } from './image.tsx';
import { DeploymentOrServicePage, KubePodDetail } from './kube.tsx';
import { ProcessPage } from './process.tsx';
import { SessionPage } from './session.tsx';
import { SimplePage } from './simple.tsx';
import type { DetailProps } from './types.ts';

export function Detail({ target, snap, open, onBack, onOpen }: { target: Target; snap: Snapshot; open: Open; onBack(): void; onOpen(o: Open): void }) {
  const host = useHost();
  const project = useProject();
  const call = useCall();
  const confirm = confirmer(host);
  const [busy, setBusy] = useState(false);
  const t = target.id;
  const act = async (action: Action, extra: Record<string, unknown> = {}, back = false) => {
    setBusy(true);
    const ok = (await call({ op: 'action', target: t, action, id: open.id, namespace: open.namespace, ...extra })) !== undefined;
    setBusy(false);
    if (ok && back) onBack();
  };
  const shell = (extra: Record<string, unknown> = {}) =>
    project
      ? void call({ op: 'shell', project: project.id, target: t, id: open.id, namespace: open.namespace, ...extra })
      : host.app.toast('Open a project to open a terminal in it', { error: true });

  const header = (dot: string | null, sub: React.ReactNode, actions: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--node-border)] px-3 py-2">
      <ToolButton label="Back" icon={ArrowLeft} onClick={onBack} />
      {dot && <span className={cn('size-2.5 flex-none rounded-full', dot)} />}
      <div className="min-w-40 flex-1 basis-48">
        <div className="truncate text-sm font-semibold">{open.name}</div>
        <div className="truncate text-[var(--node-muted)]">{sub}</div>
      </div>
      <div className="flex flex-wrap gap-1">{actions}</div>
    </div>
  );

  const p: DetailProps = { target, snap, open, onBack, onOpen, host, confirm, busy, act, shell, header };
  if (open.thing === 'container') return <ContainerPage {...p} />;
  if (open.thing === 'image') return <ImagePage {...p} />;
  if (open.thing === 'volume' || open.thing === 'network' || open.thing === 'pod') return <SimplePage {...p} />;
  if (open.thing === 'kubePod') return <KubePodDetail {...p} />;
  if (open.thing === 'deployment' || open.thing === 'service') return <DeploymentOrServicePage {...p} />;
  if (open.thing === 'process') return <ProcessPage {...p} />;
  // A screen or tmux session.
  return <SessionPage {...p} />;
}
