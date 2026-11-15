// The list a section shows, beside the sidebar: the search and the actions
// under way are kept here, across sections (as is the containers list's
// "only running" and its folded groups); each section's list is a file of
// its own, drawn as a part of this one.

import { useState } from 'react';
import { useHost, useProject } from '@hyperpane/sdk/client';
import type { Action, Snapshot, Target } from '../../shared/index.ts';
import type { Section } from '../app/sections.ts';
import { confirmer, useCall } from '../lib/calls.ts';
import type { Open } from '../lib/open.ts';
import { containersList } from './containers.tsx';
import { DiskView } from './disk.tsx';
import { imagesList } from './images.tsx';
import { deploymentsList, kubePodsList, servicesList } from './kubernetes.tsx';
import { networksList } from './networks.tsx';
import { podsList } from './podman.tsx';
import { processesList } from './processes.tsx';
import { sessionsList } from './sessions.tsx';
import type { ListProps } from './types.ts';
import { volumesList } from './volumes.tsx';

export function List({ section, target, snap, ns, narrow, onOpen }: { section: Section; target: Target; snap: Snapshot; ns?: string; narrow: boolean; onOpen(o: Open): void }) {
  const wide = !narrow;
  const host = useHost();
  const project = useProject();
  const call = useCall();
  const confirm = confirmer(host);
  const [filter, setFilter] = useState('');
  const [onlyRunning, setOnlyRunning] = useState(false);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const q = filter.trim().toLowerCase();
  const match = (...s: (string | number | null | undefined)[]) => !q || s.some((x) => String(x ?? '').toLowerCase().includes(q));
  const act = async (action: Action, id: string, extra: Record<string, unknown> = {}) => {
    const key = `${action}:${id}`;
    setBusy((b) => new Set(b).add(key));
    await call({ op: 'action', target: target.id, action, id, ...extra });
    setBusy((b) => {
      const n = new Set(b);
      n.delete(key);
      return n;
    });
  };
  const is = (action: Action, id: string) => busy.has(`${action}:${id}`);
  const shell = (id: string, extra: Record<string, unknown> = {}) =>
    project ? void call({ op: 'shell', project: project.id, target: target.id, id, ...extra }) : host.app.toast('Open a project to open a terminal in it', { error: true });
  const all = ns === '*';

  const p: ListProps = { target, snap, wide, all, host, call, confirm, filter, setFilter, match, act, is, shell, onOpen };

  // Each is called, not mounted: the lists share this one's place, as parts
  // of it.
  if (section === 'containers') return containersList({ ...p, onlyRunning, setOnlyRunning, folded, setFolded });
  if (section === 'images') return imagesList(p);
  if (section === 'volumes') return volumesList(p);
  if (section === 'networks') return networksList(p);
  if (section === 'pods') return podsList(p);
  if (section === 'disk') return <DiskView target={target.id} />;
  if (section === 'kubePods') return kubePodsList(p);
  if (section === 'deployments') return deploymentsList(p);
  if (section === 'services') return servicesList(p);
  if (section === 'processes') return processesList(p);
  // Sessions (screen, tmux).
  return sessionsList(p);
}
