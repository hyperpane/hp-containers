// The page of a volume, a network or a Podman pod: what it is (a volume's
// driver, users and mountpoint), removing it, and its Inspect.

import { Trash2 } from 'lucide-react';
import { ToolButton } from '@hyperpane/ui';
import type { Action } from '../../shared/index.ts';
import { InspectView } from '../views/InspectView.tsx';
import { Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function SimplePage(props: DetailProps) {
  const { target, snap, open, confirm, busy, act, header } = props;
  const t = target.id;
  const v = open.thing === 'volume' ? snap.volumes?.find((x) => x.name === open.id) : null;
  const remove: Action = open.thing === 'volume' ? 'removeVolume' : open.thing === 'network' ? 'removeNetwork' : 'podRemove';
  return (
    <Page
      tabs={[{ id: 'inspect', name: 'Inspect' }]}
      header={header(
        null,
        v ? `${v.driver} · used by ${v.usedBy.join(', ') || 'nothing'} · ${v.mountpoint}` : open.thing,
        <ToolButton
          label="Remove"
          icon={Trash2}
          disabled={busy}
          onClick={async () => {
            if (await confirm(`Remove ${open.name}?`, open.thing === 'volume' ? 'It goes, with everything in it' : 'It goes', 'Remove'))
              void act(remove, {}, true);
          }}
        />,
      )}
    >
      {() => <InspectView request={{ target: t, thing: open.thing, id: open.id }} />}
    </Page>
  );
}
