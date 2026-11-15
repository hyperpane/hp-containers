// The Networks list: each network with its driver and scope, to remove
// (not the built-in ones); and cleaning up the unused ones.

import { Trash2 } from 'lucide-react';
import { ToolButton, cn } from '@hyperpane/ui';
import { Btn } from '../ui/controls.tsx';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function networksList(props: ListProps) {
  const { wide, host, call, confirm, filter, setFilter, match, act, is, target, snap, onOpen } = props;
  const list = (snap.networks ?? []).filter((n) => match(n.name, n.driver, n.id));
  return (
    <>
      <Toolbar title="Networks" filter={filter} setFilter={setFilter}>
        <Btn
          icon={Trash2}
          danger
          onClick={async () => {
            if (await confirm('Remove unused networks?', 'Networks no container uses go (not bridge, host and none)', 'Remove')) {
              const r = await call<string>({ op: 'prune', target: target.id, what: 'networks' });
              if (r !== undefined) host.app.toast(r || 'Done.');
            }
          }}
        >
          Clean up
        </Btn>
      </Toolbar>
      <Table id="networks" cols={[{ title: 'Name', w: '40%' }, { title: 'Driver' }, wide && { title: 'Scope' }, wide && { title: 'Id', w: '18%' }, { title: '', actions: 1 }]} empty={!list.length}>
        {list.map((n) => (
          <Tr key={n.id || n.name} onClick={() => onOpen({ thing: 'network', id: n.name, name: n.name })}>
            <td className={cn(td, 'font-medium')}>
              {n.name}
              {n.builtIn && <span className="ml-1.5 font-normal text-[var(--node-muted)]">built in</span>}
            </td>
            <td className={cn(td, 'text-[var(--node-muted)]')}>{n.driver}</td>
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{n.scope}</td>}
            {wide && <td className={cn(td, 'font-mono text-[var(--node-muted)]')}>{n.id}</td>}
            <Acts>
              {!n.builtIn && (
                <ToolButton
                  label="Remove"
                  icon={Trash2}
                  disabled={is('removeNetwork', n.name)}
                  onClick={async () => {
                    if (await confirm(`Remove the network ${n.name}?`, 'One a container uses can’t be removed', 'Remove')) void act('removeNetwork', n.name);
                  }}
                />
              )}
            </Acts>
          </Tr>
        ))}
      </Table>
    </>
  );
}
