// screen's or tmux's sessions: each attached or not, to attach to in a
// terminal or end.

import { SquareTerminal, Trash2 } from 'lucide-react';
import { formatAgo } from '@hyperpane/sdk/client';
import { ToolButton, cn } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function sessionsList(props: ListProps) {
  const { wide, confirm, filter, setFilter, match, act, shell, target, snap, onOpen } = props;
  const list = (snap.sessions ?? []).filter((s) => match(s.name, s.id));
  return (
    <>
      <Toolbar title={`${target.kind} sessions`} filter={filter} setFilter={setFilter} />
      <Table cols={[{ title: 'Name', w: '36%' }, { title: 'Attached' }, wide && { title: 'Windows' }, wide && { title: 'Created' }, { title: '', actions: 2 }]} empty={!list.length}>
        {list.map((s) => (
          <Tr key={s.id} onClick={() => onOpen({ thing: 'session', id: s.id, name: s.name })}>
            <td className={td}>
              <div className="flex items-center gap-2">
                <span className={cn('size-2 flex-none rounded-full', s.attached ? DOT.running : DOT.paused)} title={s.attached ? 'Attached' : 'Detached'} />
                <span className="font-medium">{s.name}</span>
                {target.kind === 'screen' && <span className="text-[var(--node-muted)]">{s.id.split('.')[0]}</span>}
              </div>
            </td>
            <td className={cn(td, 'text-[var(--node-muted)]')}>{s.attached ? 'Attached' : 'Detached'}</td>
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{s.windows ?? ''}</td>}
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{s.created ? formatAgo(s.created) : ''}</td>}
            <Acts>
              <ToolButton label="Attach (in a terminal)" icon={SquareTerminal} onClick={() => shell(s.id)} />
              <ToolButton
                label="End the session"
                icon={Trash2}
                onClick={async () => {
                  if (await confirm(`End ${s.name}?`, 'The session and what runs in it end.', 'End')) void act('sessionKill', s.id);
                }}
              />
            </Acts>
          </Tr>
        ))}
      </Table>
    </>
  );
}
