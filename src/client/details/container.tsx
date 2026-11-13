// A container's page: its id, image, status and ports (to open), its
// actions (start, stop, pause, restart, a shell, kill, remove), and tabs:
// Logs, Inspect, Files (while it runs) and Stats.

import { ExternalLink, Pause, Play, RotateCw, Skull, Square, SquareTerminal, Trash2 } from 'lucide-react';
import { ToolButton } from '@hyperpane/ui';
import { DOT, openable } from '../lib/status.ts';
import { Btn, Loading } from '../ui/controls.tsx';
import { FilesView } from '../views/FilesView.tsx';
import { InspectView } from '../views/InspectView.tsx';
import { LogView } from '../views/LogView.tsx';
import { StatsView } from '../views/StatsView.tsx';
import { Gone, Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function ContainerPage(props: DetailProps) {
  const { target, snap, open, onBack, host, confirm, busy, act, shell, header } = props;
  const t = target.id;
  const c = snap.containers?.find((x) => x.id === open.id);
  if (!c) return <Gone onBack={onBack} what="This container" />;
  const on = c.state === 'running' || c.state === 'restarting';
  return (
    <Page
      tabs={[
        { id: 'logs', name: 'Logs' },
        { id: 'inspect', name: 'Inspect' },
        { id: 'files', name: 'Files' },
        { id: 'stats', name: 'Stats' },
      ]}
      first={open.tab}
      header={header(
        DOT[c.state] ?? DOT.created,
        <>
          <span className="font-mono">{c.id}</span> · {c.image} · {c.status}
          {c.ports.map((p) => {
            const url = openable(p);
            return url ? (
              <button key={p} type="button" className="ml-2 inline-flex items-center gap-0.5 text-[var(--node-accent)] hover:underline" onClick={() => host.app.openExternal(url)}>
                {p.split('->')[0]}
                <ExternalLink className="size-3" />
              </button>
            ) : null;
          })}
        </>,
        <>
          {c.state === 'paused' ? (
            <Btn icon={Play} disabled={busy} onClick={() => void act('unpause')}>
              Unpause
            </Btn>
          ) : on ? (
            <>
              <Btn icon={Square} disabled={busy} onClick={() => void act('stop')}>
                Stop
              </Btn>
              <Btn icon={Pause} disabled={busy} onClick={() => void act('pause')}>
                Pause
              </Btn>
            </>
          ) : (
            <Btn icon={Play} disabled={busy} onClick={() => void act('start')}>
              Start
            </Btn>
          )}
          <Btn icon={RotateCw} disabled={busy} onClick={() => void act('restart')}>
            Restart
          </Btn>
          <Btn icon={SquareTerminal} disabled={c.state !== 'running'} onClick={() => shell()}>
            Shell
          </Btn>
          {on && (
            <ToolButton
              label="Kill"
              icon={Skull}
              disabled={busy}
              onClick={async () => {
                if (await confirm(`Kill ${c.name}?`, 'It stops at once, without the time to finish cleanly.', 'Kill')) void act('kill');
              }}
            />
          )}
          <ToolButton
            label="Remove"
            icon={Trash2}
            disabled={busy}
            onClick={async () => {
              if (await confirm(`Remove ${c.name}?`, 'The container goes (its volumes stay).', 'Remove')) void act('remove', {}, true);
            }}
          />
        </>,
      )}
    >
      {(tab) =>
        tab === 'logs' ? (
          <LogView request={{ target: t, id: c.id }} timestamps />
        ) : tab === 'inspect' ? (
          <InspectView request={{ target: t, thing: 'container', id: c.id }} />
        ) : tab === 'files' ? (
          c.state === 'running' ? (
            <FilesView request={{ target: t, id: c.id }} canCopy />
          ) : (
            <Loading>Start it to walk its files (they’re listed by a shell inside it).</Loading>
          )
        ) : (
          <StatsView target={t} id={c.id} />
        )
      }
    </Page>
  );
}
