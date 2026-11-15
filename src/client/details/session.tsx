// A screen or tmux session's page: attached or not, attaching to it in a
// terminal, ending it, and its screen (looked at again every 2 s).

import { SquareTerminal, Trash2 } from 'lucide-react';
import { ToolButton } from '@hyperpane/ui';
import { DOT } from '../lib/status.ts';
import { Btn } from '../ui/controls.tsx';
import { TextView } from '../views/TextView.tsx';
import { Gone, Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function SessionPage(props: DetailProps) {
  const { target, snap, open, onBack, confirm, act, shell, header } = props;
  const t = target.id;
  const s = snap.sessions?.find((x) => x.id === open.id);
  if (!s) return <Gone onBack={onBack} what="This session" />;
  return (
    <Page
      tabs={[{ id: 'screen', name: 'Screen' }]}
      header={header(
        s.attached ? DOT.running : DOT.paused,
        `${target.kind} · ${s.attached ? 'attached' : 'detached'}${s.windows ? ` · ${s.windows} windows` : ''}`,
        <>
          <Btn icon={SquareTerminal} onClick={() => shell()}>
            Attach
          </Btn>
          <ToolButton
            label="End the session"
            icon={Trash2}
            onClick={async () => {
              if (await confirm(`End ${s.name}?`, 'The session and what runs in it end', 'End')) void act('sessionKill', {}, true);
            }}
          />
        </>,
      )}
    >
      {() => <TextView request={{ op: 'screen', target: t, id: s.id }} every={2000} />}
    </Page>
  );
}
