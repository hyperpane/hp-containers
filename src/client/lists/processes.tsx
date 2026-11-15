// pm2's processes: each with its status, CPU, memory, restarts and uptime,
// to start, stop, restart or delete from pm2.

import { Play, RotateCw, Square, Trash2 } from 'lucide-react';
import { formatAgo, formatSize } from '@hyperpane/sdk/client';
import { ToolButton, cn } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function processesList(props: ListProps) {
  const { wide, confirm, filter, setFilter, match, act, is, snap, onOpen } = props;
  const list = (snap.processes ?? []).filter((p) => match(p.name, p.id, p.status, p.cwd));
  return (
    <>
      <Toolbar title="Processes" filter={filter} setFilter={setFilter} />
      <Table
        id="processes"
        cols={[{ title: 'Name', w: '28%' }, { title: 'Status' }, { title: 'CPU', w: '8%' }, { title: 'Memory', w: '11%' }, wide && { title: 'Restarts', w: '9%' }, wide && { title: 'Uptime' }, wide && { title: 'Mode' }, { title: '', actions: 3 }]}
        empty={!list.length}
      >
        {list.map((p) => {
          const on = p.status === 'online';
          return (
            <Tr key={p.id} onClick={() => onOpen({ thing: 'process', id: p.id, name: p.name })}>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 flex-none rounded-full', DOT[p.status] ?? DOT.created)} />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-[var(--node-muted)]">#{p.id}</span>
                </div>
              </td>
              <td className={cn(td, p.status === 'errored' ? 'text-[var(--ansi-1)]' : 'text-[var(--node-muted)]')}>{p.status}</td>
              <td className={cn(td, 'text-[var(--node-muted)]')}>{on ? `${p.cpu}%` : ''}</td>
              <td className={cn(td, 'text-[var(--node-muted)]')}>{on ? formatSize(p.memory) : ''}</td>
              {wide && <td className={cn(td, p.restarts ? 'text-[var(--ansi-3)]' : 'text-[var(--node-muted)]')}>{p.restarts}</td>}
              {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{p.since ? formatAgo(p.since) : ''}</td>}
              {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{p.mode}</td>}
              <Acts>
                {on ? (
                  <ToolButton label="Stop" icon={Square} disabled={is('pm2Stop', p.id)} onClick={() => void act('pm2Stop', p.id)} />
                ) : (
                  <ToolButton label="Start" icon={Play} disabled={is('pm2Start', p.id)} onClick={() => void act('pm2Start', p.id)} />
                )}
                <ToolButton label="Restart" icon={RotateCw} disabled={is('pm2Restart', p.id)} onClick={() => void act('pm2Restart', p.id)} />
                <ToolButton
                  label="Delete from pm2"
                  icon={Trash2}
                  onClick={async () => {
                    if (await confirm(`Delete ${p.name} from pm2?`, 'It stops, and pm2 forgets it (until it’s started again).', 'Delete')) void act('pm2Delete', p.id);
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
