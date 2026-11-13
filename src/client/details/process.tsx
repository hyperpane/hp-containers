// A pm2 process's page: its id, status, pid, mode, restarts and folder, its
// actions (start, stop, restart, reload, delete from pm2), and tabs: Logs
// and Inspect.

import { Play, RotateCw, Square, Trash2 } from 'lucide-react';
import { ToolButton } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Btn } from '../ui/controls.tsx';
import { InspectView } from '../views/InspectView.tsx';
import { LogView } from '../views/LogView.tsx';
import { Gone, Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function ProcessPage(props: DetailProps) {
  const { target, snap, open, onBack, confirm, busy, act, header } = props;
  const t = target.id;
  const p = snap.processes?.find((x) => x.id === open.id);
  if (!p) return <Gone onBack={onBack} what="This process" />;
  const on = p.status === 'online';
  return (
    <Page
      tabs={[
        { id: 'logs', name: 'Logs' },
        { id: 'inspect', name: 'Inspect' },
      ]}
      header={header(
        DOT[p.status] ?? DOT.created,
        `#${p.id} · ${p.status}${p.pid ? ` · pid ${p.pid}` : ''} · ${p.mode} · ${p.restarts} restarts · ${p.cwd}`,
        <>
          {on ? (
            <Btn icon={Square} disabled={busy} onClick={() => void act('pm2Stop')}>
              Stop
            </Btn>
          ) : (
            <Btn icon={Play} disabled={busy} onClick={() => void act('pm2Start')}>
              Start
            </Btn>
          )}
          <Btn icon={RotateCw} disabled={busy} onClick={() => void act('pm2Restart')}>
            Restart
          </Btn>
          <Btn icon={RotateCw} disabled={busy || !on} title="Without stopping (cluster mode: one at a time)" onClick={() => void act('pm2Reload')}>
            Reload
          </Btn>
          <ToolButton
            label="Delete from pm2"
            icon={Trash2}
            onClick={async () => {
              if (await confirm(`Delete ${p.name} from pm2?`, 'It stops, and pm2 forgets it.', 'Delete')) void act('pm2Delete', {}, true);
            }}
          />
        </>,
      )}
    >
      {(tab) => (tab === 'logs' ? <LogView request={{ target: t, id: p.id }} /> : <InspectView request={{ target: t, thing: 'process', id: p.id }} />)}
    </Page>
  );
}
