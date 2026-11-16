// Kubernetes' lists: pods (their phase, readiness, restarts, node; a shell
// in one, or delete it), deployments (scale, or restart with a rollout)
// and services. With every namespace shown, each name says its own.

import { Layers, RotateCw, SquareTerminal, Trash2 } from 'lucide-react';
import { formatAgo } from '@hyperpane/sdk/client';
import { ToolButton, cn } from '@hyperpane/ui';
import { DOT, kubeDot } from '../lib/status.ts';
import { Acts, Table, Toolbar, Tr, td } from './table.tsx';
import type { ListProps } from './types.ts';

export function kubePodsList(props: ListProps) {
  const { wide, confirm, filter, setFilter, match, act, is, shell, all, snap, onOpen } = props;
  const list = (snap.kubePods ?? []).filter((p) => match(p.name, p.namespace, p.node, p.phase));
  return (
    <>
      <Toolbar title="Pods" filter={filter} setFilter={setFilter} />
      <Table
        id="pods"
        cols={[
          { title: 'Name', w: '34%' },
          { title: 'Status' },
          { title: 'Ready', w: '9%' },
          wide && { title: 'Restarts', w: '10%' },
          wide && { title: 'Age', w: '12%' },
          wide && { title: 'Node', w: '14%' },
          { title: '', actions: 2 },
        ]}
        empty={!list.length}
      >
        {list.map((p) => (
          <Tr
            key={`${p.namespace}/${p.name}`}
            onClick={() => onOpen({ thing: 'kubePod', id: p.name, name: p.name, namespace: p.namespace, containers: p.containers })}
          >
            <td className={td}>
              <div className="flex items-center gap-2">
                <span className={cn('size-2 flex-none rounded-full', kubeDot(p.phase))} />
                <span className="font-medium">
                  {all && <span className="font-normal text-[var(--node-muted)]">{p.namespace}/</span>}
                  {p.name}
                </span>
              </div>
            </td>
            <td className={cn(td, !['Running', 'Succeeded'].includes(p.phase) && 'text-[var(--ansi-3)]')}>{p.phase}</td>
            <td className={cn(td, 'text-[var(--node-muted)]')}>{p.ready}</td>
            {wide && <td className={cn(td, p.restarts ? 'text-[var(--ansi-3)]' : 'text-[var(--node-muted)]')}>{p.restarts}</td>}
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{p.created ? formatAgo(p.created) : ''}</td>}
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{p.node}</td>}
            <Acts>
              <ToolButton
                label="Shell (in a terminal)"
                icon={SquareTerminal}
                disabled={p.phase !== 'Running'}
                onClick={() => shell(p.name, { namespace: p.namespace })}
              />
              <ToolButton
                label="Delete"
                icon={Trash2}
                disabled={is('deletePod', p.name)}
                onClick={async () => {
                  if (await confirm(`Delete ${p.name}?`, 'A pod a deployment owns comes back as a new one; one on its own is gone', 'Delete'))
                    void act('deletePod', p.name, { namespace: p.namespace });
                }}
              />
            </Acts>
          </Tr>
        ))}
      </Table>
    </>
  );
}

export function deploymentsList(props: ListProps) {
  const { wide, host, filter, setFilter, match, act, is, all, snap, onOpen } = props;
  const list = (snap.deployments ?? []).filter((d) => match(d.name, d.namespace));
  return (
    <>
      <Toolbar title="Deployments" filter={filter} setFilter={setFilter} />
      <Table
        id="deployments"
        cols={[{ title: 'Name', w: '50%' }, { title: 'Ready' }, wide && { title: 'Age' }, { title: '', actions: 2 }]}
        empty={!list.length}
      >
        {list.map((d) => {
          const [ready, want] = d.ready.split('/').map(Number);
          return (
            <Tr key={`${d.namespace}/${d.name}`} onClick={() => onOpen({ thing: 'deployment', id: d.name, name: d.name, namespace: d.namespace })}>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 flex-none rounded-full', want === 0 ? DOT.exited : ready === want ? DOT.running : DOT.restarting)} />
                  <span className="font-medium">
                    {all && <span className="font-normal text-[var(--node-muted)]">{d.namespace}/</span>}
                    {d.name}
                  </span>
                </div>
              </td>
              <td className={cn(td, 'text-[var(--node-muted)]')}>{d.ready}</td>
              {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{d.created ? formatAgo(d.created) : ''}</td>}
              <Acts>
                <ToolButton
                  label="Scale"
                  icon={Layers}
                  onClick={async () => {
                    const n = await host.ui.prompt({ title: `Scale ${d.name}`, label: 'Replicas', value: String(d.replicas) });
                    if (n !== null && n.trim() !== '') void act('scale', d.name, { namespace: d.namespace, replicas: Number(n) });
                  }}
                />
                <ToolButton
                  label="Restart (a rollout)"
                  icon={RotateCw}
                  disabled={is('rolloutRestart', d.name)}
                  onClick={() => void act('rolloutRestart', d.name, { namespace: d.namespace })}
                />
              </Acts>
            </Tr>
          );
        })}
      </Table>
    </>
  );
}

export function servicesList(props: ListProps) {
  const { wide, filter, setFilter, match, all, snap, onOpen } = props;
  const list = (snap.services ?? []).filter((s) => match(s.name, s.namespace, s.type, s.clusterIP));
  return (
    <>
      <Toolbar title="Services" filter={filter} setFilter={setFilter} />
      <Table
        id="services"
        cols={[{ title: 'Name', w: '30%' }, { title: 'Type' }, wide && { title: 'Cluster IP' }, { title: 'Ports' }, wide && { title: 'Age' }]}
        empty={!list.length}
      >
        {list.map((s) => (
          <Tr key={`${s.namespace}/${s.name}`} onClick={() => onOpen({ thing: 'service', id: s.name, name: s.name, namespace: s.namespace })}>
            <td className={cn(td, 'font-medium')}>
              {all && <span className="font-normal text-[var(--node-muted)]">{s.namespace}/</span>}
              {s.name}
            </td>
            <td className={cn(td, 'text-[var(--node-muted)]')}>{s.type}</td>
            {wide && <td className={cn(td, 'font-mono text-[var(--node-muted)]')}>{s.clusterIP}</td>}
            <td className={cn(td, 'text-[var(--node-muted)]')}>{s.ports.join(', ')}</td>
            {wide && <td className={cn(td, 'text-[var(--node-muted)]')}>{s.created ? formatAgo(s.created) : ''}</td>}
          </Tr>
        ))}
      </Table>
    </>
  );
}
