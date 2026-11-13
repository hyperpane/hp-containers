// The Containers list: each container with its state, image, status and
// ports (the ones to open in a browser as links), and its actions; grouped
// by Compose project (or Podman pod), each group folding, with the
// project's own start, stop, restart and down.

import { ChevronDown, ChevronRight, ListTree, Play, RotateCw, Square, SquareTerminal, Trash2 } from 'lucide-react';
import { ToolButton, cn } from '@hyperpane/ui';
import type { Container } from '../../shared/index.ts';
import { DOT, openable } from '../lib/status.ts';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

/** What the containers list keeps while another section is shown. */
export interface ContainersState {
  onlyRunning: boolean;
  setOnlyRunning(v: boolean): void;
  /** The groups folded. */
  folded: Set<string>;
  setFolded: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function containersList(props: ListProps & ContainersState) {
  const { wide, host, confirm, filter, setFilter, match, act, is, shell, snap, onOpen, onlyRunning, setOnlyRunning, folded, setFolded } = props;
  const list = (snap.containers ?? []).filter((c) => (!onlyRunning || c.state === 'running') && match(c.name, c.image, c.group, c.id, c.ports.join(' ')));
  const groups = new Map<string, Container[]>();
  for (const c of list) groups.set(c.group ?? '', [...(groups.get(c.group ?? '') ?? []), c]);
  const ordered = [...groups].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  const running = (snap.containers ?? []).filter((c) => c.state === 'running').length;
  const row = (c: Container, nested: boolean) => {
    const on = c.state === 'running' || c.state === 'restarting';
    return (
      <Tr key={c.id} onClick={() => onOpen({ thing: 'container', id: c.id, name: c.name })}>
        <td className={cn(td, nested && 'pl-7!')}>
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('size-2 flex-none rounded-full', DOT[c.state] ?? DOT.created)} title={c.state} />
            <span className="truncate font-medium" title={c.name}>
              {c.name}
            </span>
          </div>
        </td>
        {wide && <td className={cn(td, 'text-[var(--node-muted)]')} title={c.image}>{c.image}</td>}
        <td className={cn(td, 'text-[var(--node-muted)]')} title={c.status}>
          {c.status}
        </td>
        <td className={td} onClick={(e) => e.stopPropagation()}>
          {c.ports.map((p) => {
            const url = openable(p);
            return url ? (
              <button key={p} type="button" className="mr-1 text-[var(--node-accent)] hover:underline" onClick={() => host.app.openExternal(url)}>
                {p.split('->')[0]}
              </button>
            ) : (
              <span key={p} className="mr-1 text-[var(--node-muted)]">
                {p}
              </span>
            );
          })}
        </td>
        <Acts>
          {c.state === 'paused' ? (
            <ToolButton label="Unpause" icon={Play} disabled={is('unpause', c.id)} onClick={() => void act('unpause', c.id)} />
          ) : on ? (
            <ToolButton label="Stop" icon={Square} disabled={is('stop', c.id)} onClick={() => void act('stop', c.id)} />
          ) : (
            <ToolButton label="Start" icon={Play} disabled={is('start', c.id)} onClick={() => void act('start', c.id)} />
          )}
          <ToolButton label="Restart" icon={RotateCw} disabled={is('restart', c.id)} onClick={() => void act('restart', c.id)} />
          <ToolButton label="Shell (in a terminal)" icon={SquareTerminal} disabled={c.state !== 'running'} onClick={() => shell(c.id)} />
          <ToolButton
            label="Remove"
            icon={Trash2}
            disabled={is('remove', c.id)}
            onClick={async () => {
              if (await confirm(`Remove ${c.name}?`, on ? 'It’s running: it stops, and the container goes (its volumes stay).' : 'The container goes (its volumes stay).', 'Remove')) void act('remove', c.id);
            }}
          />
        </Acts>
      </Tr>
    );
  };
  return (
    <>
      <Toolbar title="Containers" filter={filter} setFilter={setFilter}>
        <span className="text-[var(--node-muted)]">
          {running} of {snap.containers?.length ?? 0} running
        </span>
        <label className="flex items-center gap-1 text-[var(--node-muted)]">
          <input type="checkbox" checked={onlyRunning} onChange={(e) => setOnlyRunning(e.target.checked)} />
          Only running
        </label>
      </Toolbar>
      <Table cols={[{ title: 'Name', w: '30%' }, wide && { title: 'Image', w: '22%' }, { title: 'Status' }, { title: 'Ports', w: '16%' }, { title: '', actions: 4 }]} empty={!list.length}>
        {ordered.map(([group, items]) =>
          group ? (
            [
              <Tr key={`g:${group}`}>
                <td className={cn(td, 'font-medium')} colSpan={wide ? 3 : 2}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5"
                    onClick={() =>
                      setFolded((f) => {
                        const n = new Set(f);
                        if (n.has(group)) n.delete(group);
                        else n.add(group);
                        return n;
                      })
                    }
                  >
                    {folded.has(group) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    <ListTree className="size-3.5 text-[var(--node-muted)]" />
                    {group}
                    <span className="font-normal text-[var(--node-muted)]">
                      {items.filter((c) => c.state === 'running').length}/{items.length} running
                    </span>
                  </button>
                </td>
                <td className={td} />
                {snap.pods?.some((p) => p.name === group) ? (
                  <td className={td} />
                ) : (
                  <Acts>
                    <ToolButton label="Start the project" icon={Play} disabled={is('composeStart', group)} onClick={() => void act('composeStart', group)} />
                    <ToolButton label="Stop the project" icon={Square} disabled={is('composeStop', group)} onClick={() => void act('composeStop', group)} />
                    <ToolButton label="Restart the project" icon={RotateCw} disabled={is('composeRestart', group)} onClick={() => void act('composeRestart', group)} />
                    <ToolButton
                      label="Down: remove its containers and networks"
                      icon={Trash2}
                      disabled={is('composeDown', group)}
                      onClick={async () => {
                        if (await confirm(`Down ${group}?`, 'Its containers and networks are removed (compose down). Volumes stay.', 'Down')) void act('composeDown', group);
                      }}
                    />
                  </Acts>
                )}
              </Tr>,
              ...(folded.has(group) ? [] : items.map((c) => row(c, true))),
            ]
          ) : (
            items.map((c) => row(c, false))
          ),
        )}
      </Table>
    </>
  );
}
