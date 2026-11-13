// The Containers window, laid out as Docker Desktop is: a sidebar (the
// manager, then what it has: containers, images, volumes, networks, disk
// usage; pods, deployments and services for Kubernetes; processes for pm2;
// sessions for screen and tmux), a list, and a page for what's opened in it.
//
// This is the window and its sidebar: which manager (and namespace) is
// shown, what it runs (watched), and which section or thing is open. The
// lists are in lists/, the pages in details/.

import { useEffect, useState } from 'react';
import { RefreshCw, Server } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { NodeMessage, ToolButton, cn } from '@hyperpane/ui';
import type { Snapshot, Target } from '../../shared/index.ts';
import { Detail } from '../details/Detail.tsx';
import { ID } from '../lib/calls.ts';
import { useKept, useWidth } from '../lib/hooks.ts';
import type { Open } from '../lib/open.ts';
import { List } from '../lists/List.tsx';
import { Loading } from '../ui/controls.tsx';
import { Picker } from '../ui/Picker.tsx';
import { SECTIONS, type Section, count, sectionsFor } from './sections.ts';

export function ContainersView() {
  const host = useHost();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [section, setSection] = useState<Section>('containers');
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [side, setSide] = useKept('containers.sidebar', 184);
  const [mainRef, mainWidth] = useWidth<HTMLElement>();

  const load = () => {
    setTargets(null);
    host.call<Target[]>(ID, { op: 'targets' }).then(
      (list) => {
        setTargets(list);
        setTargetId((id) => (id && list.some((t) => t.id === id) ? id : ((list.find((t) => t.ok) ?? list.find((t) => t.installed !== false) ?? list[0])?.id ?? null)));
        setTick((t) => t + 1);
      },
      (e: Error) => setError(e.message),
    );
  };
  useEffect(load, [host]);

  const target = targets?.find((t) => t.id === targetId) ?? null;
  const kube = target?.kind === 'kubernetes';
  const ns = kube ? (namespace ?? target?.namespace ?? 'default') : undefined;

  useEffect(() => {
    if (!target) return;
    setSnap(null);
    setOpen(null);
    setSection(sectionsFor(target.kind, null)[0]);
    if (target.installed === false || (!target.ok && target.kind === 'kubernetes' && !target.context)) return;
    return host.subscribe<Snapshot>(ID, { op: 'watch', target: target.id, namespace: ns }, setSnap, { onEnd: (e) => e && setError(e) });
  }, [target?.id, ns, host, tick]);

  if (error) return <NodeMessage error>{error}</NodeMessage>;
  if (!targets) return <NodeMessage>Looking for Docker, Podman, nerdctl, kubectl, pm2, tmux and screen…</NodeMessage>;
  if (!targets.length) return <NodeMessage>No managers.</NodeMessage>;

  const sections = sectionsFor(target?.kind, snap);
  const narrow = mainWidth > 0 && mainWidth < 620;
  // Dragging the sidebar's edge: 132 to 360 px.
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = e.clientX;
    const start = side;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setSide(Math.max(132, Math.min(360, Math.round(start + ev.clientX - from))));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <div className="flex h-full min-w-0 text-xs text-[var(--node-fg)]">
      <aside className="relative flex flex-none flex-col gap-2 border-r border-[var(--node-border)] p-2" style={{ width: side }}>
        <Picker
          label="Manager"
          className="font-medium"
          value={target?.id ?? ''}
          options={[
            ...targets.filter((t) => t.installed !== false).map((t) => ({ id: t.id, label: `${t.ok ? '●' : '○'}  ${t.name}` })),
            ...(targets.some((t) => t.installed === false) ? [{ id: '-', label: '', separator: true }] : []),
            ...targets.filter((t) => t.installed === false).map((t) => ({ id: t.id, label: `${t.name}: not installed` })),
          ]}
          onChange={(id) => {
            setTargetId(id);
            setNamespace(null);
          }}
        />
        {kube && snap && !snap.error && (
          <Picker
            label="Namespace"
            value={ns!}
            options={[{ id: '*', label: 'All namespaces' }, ...[...new Set([...(snap.namespaces ?? []), ns!])].filter((n) => n !== '*').map((n) => ({ id: n, label: n }))]}
            onChange={(n) => {
              setNamespace(n);
              setOpen(null);
            }}
          />
        )}
        <nav className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const Icon = SECTIONS[s].icon;
            const n = count(s, snap);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSection(s);
                  setOpen(null);
                }}
                className={cn(
                  'rounded-control flex h-7 items-center gap-2 px-2 text-left transition-colors duration-100',
                  section === s && !open ? 'bg-[color-mix(in_srgb,var(--node-accent)_22%,transparent)]' : section === s ? 'bg-[var(--node-hover)]' : 'text-[var(--node-muted)] hover:bg-[var(--node-hover)] hover:text-[var(--node-fg)]',
                )}
              >
                <Icon className="size-3.5 flex-none" />
                <span className="min-w-0 flex-1 truncate">{SECTIONS[s].name}</span>
                {n !== undefined && <span className="text-[var(--node-muted)]">{n}</span>}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-1 text-[10px] text-[var(--node-muted)]">
          <Server className="size-3 flex-none" />
          <span className="min-w-0 flex-1 truncate" title={target?.detail ?? undefined}>
            {target?.ok ? target.detail : 'Not running'}
          </span>
          <ToolButton label="Look for managers again" icon={RefreshCw} onClick={load} />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Sidebar width (drag)"
          title="Drag to resize; double-click for the usual width"
          className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-[color-mix(in_srgb,var(--node-accent)_35%,transparent)]"
          onPointerDown={drag}
          onDoubleClick={() => setSide(184)}
        />
      </aside>
      <main ref={mainRef} className="flex min-w-0 flex-1 flex-col">
        {target && !target.ok ? (
          <div className="p-4 text-[var(--ansi-3)]">{target.error}</div>
        ) : !snap ? (
          <Loading />
        ) : snap.error ? (
          <div className="p-4 text-[var(--ansi-1)]">{snap.error}</div>
        ) : open ? (
          <Detail key={JSON.stringify(open)} target={target!} snap={snap} open={open} onBack={() => setOpen(null)} onOpen={setOpen} />
        ) : (
          <List section={section} target={target!} snap={snap} ns={ns} narrow={narrow} onOpen={setOpen} />
        )}
      </main>
    </div>
  );
}
