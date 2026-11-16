// The Images list: each image with its size and age (one no container uses
// shows so), to run or remove; pulling one, and cleaning up dangling ones.

import { Play, Trash2 } from 'lucide-react';
import { ToolButton, cn } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Btn } from '../ui/controls.tsx';
import { Pull } from './pull.tsx';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function imagesList(props: ListProps) {
  const { wide, host, call, confirm, filter, setFilter, match, act, is, target, snap, onOpen } = props;
  const list = (snap.images ?? []).filter((i) => match(i.name, i.id));
  return (
    <>
      <Toolbar title="Images" filter={filter} setFilter={setFilter}>
        <Pull target={target.id} />
        <Btn
          icon={Trash2}
          danger
          onClick={async () => {
            if (await confirm('Remove unused images?', 'Dangling images (<none>) go. To remove every image no container uses, use Disk usage.', 'Remove')) {
              const r = await call<string>({ op: 'prune', target: target.id, what: 'images' });
              if (r) host.app.toast(r);
            }
          }}
        >
          Clean up
        </Btn>
      </Toolbar>
      <Table
        id="images"
        cols={[
          { title: 'Name', w: '40%' },
          wide && { title: 'Id', w: '15%' },
          wide && { title: 'Created' },
          { title: 'Size', w: '12%' },
          { title: '', actions: 2 },
        ]}
        empty={!list.length}
      >
        {list.map((i) => {
          const ref = i.name === '<none>' ? i.id : i.name;
          return (
            <Tr key={`${i.id}:${i.name}`} onClick={() => onOpen({ thing: 'image', id: ref, name: i.name })}>
              <td className={td}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('size-2 flex-none rounded-full', i.containers ? DOT.running : DOT.created)} title={i.containers ? 'In use' : 'Unused'} />
                  <span className={cn('truncate font-medium', i.name === '<none>' && 'text-[var(--node-muted)] italic')} title={i.name}>
                    {i.name}
                  </span>
                </div>
              </td>
              {wide && <td className={cn(td, 'font-mono text-[var(--node-muted)]')}>{i.id}</td>}
              {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{i.created}</td>}
              <td className={cn(td, 'text-[var(--node-muted)]')}>{i.size}</td>
              <Acts>
                <ToolButton label="Run" icon={Play} onClick={() => onOpen({ thing: 'image', id: ref, name: i.name, tab: 'run' })} />
                <ToolButton
                  label="Remove"
                  icon={Trash2}
                  disabled={is('removeImage', ref)}
                  onClick={async () => {
                    if (await confirm(`Remove ${ref}?`, 'The image goes. One a container uses can’t be removed.', 'Remove')) void act('removeImage', ref);
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
