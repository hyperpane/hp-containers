// Podman's pods: each with its status and how many containers it has, to
// start, stop or remove.

import { Play, Square, Trash2 } from 'lucide-react';
import { ToolButton, cn } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function podsList(props: ListProps) {
  const { confirm, filter, setFilter, match, act, is, snap, onOpen } = props;
  const list = (snap.pods ?? []).filter((p) => match(p.name, p.id));
  return (
    <>
      <Toolbar title="Pods" filter={filter} setFilter={setFilter} />
      <Table id="podman" cols={[{ title: 'Name', w: '40%' }, { title: 'Status' }, { title: 'Containers', w: '16%' }, { title: '', actions: 2 }]} empty={!list.length}>
        {list.map((p) => {
          const on = /running/i.test(p.status);
          return (
            <Tr key={p.id} onClick={() => onOpen({ thing: 'pod', id: p.id, name: p.name })}>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 flex-none rounded-full', on ? DOT.running : DOT.exited)} />
                  <span className="font-medium">{p.name}</span>
                </div>
              </td>
              <td className={cn(td, 'text-[var(--node-muted)]')}>{p.status}</td>
              <td className={cn(td, 'text-[var(--node-muted)]')}>{p.containers}</td>
              <Acts>
                {on ? (
                  <ToolButton label="Stop" icon={Square} disabled={is('podStop', p.id)} onClick={() => void act('podStop', p.id)} />
                ) : (
                  <ToolButton label="Start" icon={Play} disabled={is('podStart', p.id)} onClick={() => void act('podStart', p.id)} />
                )}
                <ToolButton
                  label="Remove"
                  icon={Trash2}
                  onClick={async () => {
                    if (await confirm(`Remove the pod ${p.name}?`, 'It and its containers go.', 'Remove')) void act('podRemove', p.id);
                  }}
                />
              </Acts>
            </Tr>
          );
        })}
      </Table>
    </>
  );
}
