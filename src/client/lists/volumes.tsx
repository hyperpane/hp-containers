// The Volumes list: each volume with the containers using it, to remove;
// and cleaning up the unused ones.

import { Trash2 } from 'lucide-react';
import { ToolButton, cn } from '@hyperpane/ui';
import { Btn } from '../ui/controls.tsx';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function volumesList(props: ListProps) {
  const { wide, host, call, confirm, filter, setFilter, match, act, is, target, snap, onOpen } = props;
  const list = (snap.volumes ?? []).filter((v) => match(v.name, v.driver, v.usedBy.join(' ')));
  return (
    <>
      <Toolbar title="Volumes" filter={filter} setFilter={setFilter}>
        <Btn
          icon={Trash2}
          danger
          onClick={async () => {
            if (await confirm('Remove unused volumes?', 'Anonymous volumes no container uses go, with what’s in them.', 'Remove')) {
              const r = await call<string>({ op: 'prune', target: target.id, what: 'volumes' });
              if (r) host.app.toast(r);
            }
          }}
        >
          Clean up
        </Btn>
      </Toolbar>
      <Table cols={[{ title: 'Name', w: '45%' }, { title: 'Used by' }, wide && { title: 'Driver', w: '14%' }, { title: '', actions: 1 }]} empty={!list.length}>
        {list.map((v) => (
          <Tr key={v.name} onClick={() => onOpen({ thing: 'volume', id: v.name, name: v.name })}>
            <td className={cn(td, 'font-medium')} title={v.name}>
              {v.name}
            </td>
            <td className={cn(td, 'text-[var(--node-muted)]')}>{v.usedBy.join(', ') || '—'}</td>
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{v.driver}</td>}
            <Acts>
              <ToolButton
                label="Remove"
                icon={Trash2}
                disabled={is('removeVolume', v.name)}
                onClick={async () => {
                  if (await confirm(`Remove the volume ${v.name}?`, 'It goes, with everything in it. A volume a container uses can’t be removed.', 'Remove')) void act('removeVolume', v.name);
                }}
              />
            </Acts>
          </Tr>
        ))}
      </Table>
    </>
  );
}
