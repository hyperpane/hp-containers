// An image's page: its id, size and age, removing it, and tabs: Layers (what
// made each), Inspect, and Run (a container from it, with its ports,
// variables, volumes, restart and command).

import { useState } from 'react';
import { Play, Plus, Trash2, X } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { ColumnResizer, NodeInput, Picker, ToolButton, cn, styles, useColumnWidths } from '@hyperpane/ui';
import type { Layer, RunSpec } from '../../shared/index.ts';
import { useCall, useLoad } from '../lib/calls.ts';
import { Btn, Loading } from '../ui/controls.tsx';
import { InspectView } from '../views/InspectView.tsx';
import { Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function ImagePage(props: DetailProps) {
  const { target, snap, open, onOpen, confirm, busy, act, header } = props;
  const t = target.id;
  const img = snap.images?.find((x) => x.name === open.id || x.id === open.id);
  return (
    <Page
      tabs={[
        { id: 'layers', name: 'Layers' },
        { id: 'inspect', name: 'Inspect' },
        { id: 'run', name: 'Run' },
      ]}
      first={open.tab}
      header={header(
        null,
        img ? `${img.id} · ${img.size} · ${img.created}${img.containers ? ` · used by ${img.containers}` : ''}` : open.id,
        <ToolButton
          label="Remove"
          icon={Trash2}
          disabled={busy}
          onClick={async () => {
            if (await confirm(`Remove ${open.id}?`, 'The image goes. One a container uses can’t be removed.', 'Remove')) void act('removeImage', {}, true);
          }}
        />,
      )}
    >
      {(tab) =>
        tab === 'layers' ? (
          <LayersView target={t} image={open.id} />
        ) : tab === 'inspect' ? (
          <InspectView request={{ target: t, thing: 'image', id: open.id }} />
        ) : (
          <RunForm target={t} image={open.id} onRan={(id) => onOpen({ thing: 'container', id, name: id })} />
        )
      }
    </Page>
  );
}

function LayersView({ target, image }: { target: string; image: string }) {
  const { value, error } = useLoad<Layer[]>({ op: 'history', target, id: image });
  // What made a layer takes what's left; Size and Created are as wide as
  // they were dragged (from their left edge, kept on this machine).
  const cols = useColumnWidths('containers.layers', { size: 88, created: 128 }, { min: 48, max: 400 });
  if (!value) return <Loading error={error} />;
  const th = 'relative truncate border-b border-[var(--node-border)] px-2 py-1.5 text-left font-medium text-[var(--node-muted)] first:pl-3';
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: 40 }} />
          <col />
          <col style={{ width: cols.widths.size }} />
          <col style={{ width: cols.widths.created }} />
        </colgroup>
        <thead className={cn(styles.stickyTableHead, 'bg-[var(--node-bg)]')}>
          <tr>
            <th className={th} />
            <th className={th}>Made by</th>
            <th className={th}>
              Size
              <ColumnResizer {...cols.resizer('size', 'start')} />
            </th>
            <th className={th}>
              Created
              <ColumnResizer {...cols.resizer('created', 'start')} />
            </th>
          </tr>
        </thead>
        <tbody>
          {value.map((l, i) => (
            <tr key={`${l.id}:${i}`} className="border-b border-[var(--node-border)] align-top">
              <td className="py-1.5 pl-3 text-[var(--node-muted)]">{value.length - i}</td>
              <td className="px-2 py-1.5 font-mono text-[11px] break-all whitespace-pre-wrap select-text">{l.createdBy || l.comment}</td>
              <td className="truncate px-2 py-1.5 text-[var(--node-muted)]" title={l.size}>
                {l.size}
              </td>
              <td className="truncate px-2 py-1.5 text-[var(--node-muted)]" title={l.created}>
                {l.created}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows of one kind of value (ports, env, volumes), added and removed. */
function Rows({ label, hint, values, set }: { label: string; hint: string; values: string[]; set(v: string[]): void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <ToolButton label={`Add a ${label.toLowerCase()}`} icon={Plus} onClick={() => set([...values, ''])} />
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex gap-1">
          <NodeInput
            className="min-w-0 flex-1 font-mono"
            placeholder={hint}
            value={v}
            onChange={(e) => set(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <ToolButton label="Remove" icon={X} onClick={() => set(values.filter((_, j) => j !== i))} />
        </div>
      ))}
    </div>
  );
}

function RunForm({ target, image, onRan }: { target: string; image: string; onRan(id: string): void }) {
  const call = useCall();
  const host = useHost();
  const [spec, setSpec] = useState<Required<Omit<RunSpec, 'image' | 'command'>> & { command: string }>({
    name: '',
    ports: [],
    env: [],
    volumes: [],
    restart: 'no',
    command: '',
  });
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const clean = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
    const id = await call<string>({
      op: 'run',
      target,
      spec: {
        image,
        name: spec.name.trim() || undefined,
        ports: clean(spec.ports),
        env: spec.env.filter((x) => x.trim()),
        volumes: clean(spec.volumes),
        restart: spec.restart === 'no' ? undefined : spec.restart,
        command: spec.command.trim() ? spec.command.trim().split(/\s+/) : undefined,
      },
    });
    setBusy(false);
    if (id) {
      host.app.toast(`${image} runs (${id})`);
      onRan(id);
    }
  };
  return (
    <div className="flex max-w-xl flex-col gap-3 overflow-auto p-3">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Container name</span>
        <NodeInput placeholder="A name of its own (optional)" value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} />
      </label>
      <Rows label="Port" hint="8080:80 (this machine : inside)" values={spec.ports} set={(ports) => setSpec({ ...spec, ports })} />
      <Rows label="Variable" hint="KEY=value" values={spec.env} set={(env) => setSpec({ ...spec, env })} />
      <Rows label="Volume" hint="name:/data or /path/here:/path/inside[:ro]" values={spec.volumes} set={(volumes) => setSpec({ ...spec, volumes })} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Restart</span>
        <Picker
          label="Restart"
          className="w-full"
          value={spec.restart}
          options={[
            { value: 'no', label: 'Never' },
            { value: 'unless-stopped', label: 'Unless stopped' },
            { value: 'always', label: 'Always' },
            { value: 'on-failure', label: 'On failure' },
          ]}
          onValueChange={(restart) => setSpec({ ...spec, restart })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Command</span>
        <NodeInput
          className="font-mono"
          placeholder="The image’s own (optional)"
          value={spec.command}
          onChange={(e) => setSpec({ ...spec, command: e.target.value })}
        />
      </label>
      <div>
        <Btn icon={Play} disabled={busy} onClick={() => void run()}>
          Run {image}
        </Btn>
      </div>
    </div>
  );
}
