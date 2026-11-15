// Disk usage: what images, containers, volumes and the build cache take
// (and how much of it is to free), and cleaning each of them up.

import { useMemo } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { ToolButton } from '@hyperpane/ui';
import type { DiskUsage } from '../../shared/index.ts';
import { confirmer, useCall, useLoad } from '../lib/calls.ts';
import { Btn, Loading } from '../ui/controls.tsx';

export function DiskView({ target }: { target: string }) {
  const host = useHost();
  const call = useCall();
  const confirm = confirmer(host);
  const { value, error, reload } = useLoad<DiskUsage[]>({ op: 'diskUsage', target });
  const prune = async (what: string, title: string, message: string) => {
    if (!(await confirm(title, message, 'Clean up'))) return;
    const r = await call<string>({ op: 'prune', target, what });
    if (r !== undefined) host.app.toast(r || 'Done.');
    reload();
  };
  const buttons = useMemo(
    () => [
      { what: 'containers', name: 'Stopped containers', message: 'Every stopped container goes' },
      { what: 'images', name: 'Dangling images', message: 'Images without a name (<none>) go' },
      { what: 'allImages', name: 'Unused images', message: 'Every image no container uses goes: they’re pulled again when needed' },
      { what: 'volumes', name: 'Unused volumes', message: 'Anonymous volumes no container uses go, with what’s in them' },
      { what: 'networks', name: 'Unused networks', message: 'Networks no container uses go' },
      { what: 'buildCache', name: 'Build cache', message: 'The build cache goes: the next builds take longer' },
      { what: 'system', name: 'Everything unused', message: 'Stopped containers, unused networks, dangling images and the build cache go' },
    ],
    [],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex items-center border-b border-[var(--node-border)] px-3 py-2">
        <h2 className="flex-1 text-sm font-semibold">Disk usage</h2>
        <ToolButton label="Again" icon={RefreshCw} onClick={reload} />
      </div>
      {value === undefined ? (
        <Loading error={error} />
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3">
          {value.map((d) => (
            <div key={d.type} className="rounded-md border border-[var(--node-border)] p-2.5">
              <div className="text-[var(--node-muted)]">{d.type}</div>
              <div className="text-base font-semibold">{d.size}</div>
              <div className="text-[var(--node-muted)]">
                {d.active} of {d.total} in use · {d.reclaimable || '0 B'} to free
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-3 pb-3">
        <div className="mb-1.5 font-medium">Clean up</div>
        <div className="flex flex-wrap gap-1.5">
          {buttons.map((b) => (
            <Btn key={b.what} icon={Trash2} danger onClick={() => void prune(b.what, `Remove ${b.name.toLowerCase()}?`, b.message)}>
              {b.name}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}
