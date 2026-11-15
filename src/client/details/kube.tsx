// Kubernetes' pages: a pod's (its containers to pick, a shell, deleting it;
// Logs, Describe, Files while it runs, Inspect), and a deployment's or a
// service's (scale and restart a deployment; Describe and Inspect).

import { useState } from 'react';
import { Plus, RotateCw, SquareTerminal, Trash2 } from 'lucide-react';
import { Picker, ToolButton } from '@hyperpane/ui';
import type { Action } from '../../shared/index.ts';
import { kubeDot } from '../lib/status.ts';
import { Btn, Loading } from '../ui/controls.tsx';
import { FilesView } from '../views/FilesView.tsx';
import { InspectView } from '../views/InspectView.tsx';
import { LogView } from '../views/LogView.tsx';
import { TextView } from '../views/TextView.tsx';
import { Gone, Page } from './Page.tsx';
import type { DetailProps } from './types.ts';

export function KubePodDetail(props: DetailProps) {
  const { target, snap, open, onBack, confirm, busy, act, shell, header } = props;
  const t = target.id;
  const p = snap.kubePods?.find((x) => x.name === open.id && x.namespace === open.namespace);
  if (!p) return <Gone onBack={onBack} what="This pod" />;
  return <KubePodPage target={t} pod={p} header={(c) => header(kubeDot(p.phase), `${p.namespace} · ${p.phase} · ${p.ready} ready · ${p.restarts} restarts${p.node ? ` · ${p.node}` : ''}`, c)} shell={shell} act={act} busy={busy} confirm={confirm} />;
}

export function DeploymentOrServicePage(props: DetailProps) {
  const { target, snap, open, host, busy, act, header } = props;
  const t = target.id;
  return (
    <Page
      tabs={[
        { id: 'describe', name: 'Describe' },
        { id: 'inspect', name: 'Inspect' },
      ]}
      header={header(
        null,
        open.namespace,
        open.thing === 'deployment' && (
          <>
            <Btn
              icon={Plus}
              onClick={async () => {
                const d = snap.deployments?.find((x) => x.name === open.id && x.namespace === open.namespace);
                const n = await host.ui.prompt({ title: `Scale ${open.name}`, label: 'Replicas', value: String(d?.replicas ?? 1) });
                if (n !== null && n.trim() !== '') void act('scale', { replicas: Number(n) });
              }}
            >
              Scale
            </Btn>
            <Btn icon={RotateCw} disabled={busy} onClick={() => void act('rolloutRestart')}>
              Restart
            </Btn>
          </>
        ),
      )}
    >
      {(tab) =>
        tab === 'describe' ? (
          <TextView request={{ op: 'describe', target: t, thing: open.thing, id: open.id, namespace: open.namespace }} />
        ) : (
          <InspectView request={{ target: t, thing: open.thing, id: open.id, namespace: open.namespace }} />
        )
      }
    </Page>
  );
}

function KubePodPage(props: {
  target: string;
  pod: { name: string; namespace: string; phase: string; containers: string[] };
  header(actions: React.ReactNode): React.ReactNode;
  shell(extra?: Record<string, unknown>): void;
  act(a: Action, extra?: Record<string, unknown>, back?: boolean): Promise<void>;
  busy: boolean;
  confirm(t: string, m: string, l: string): Promise<boolean>;
}) {
  const { pod, target } = props;
  const [container, setContainer] = useState<string>('');
  const req = { target, id: pod.name, namespace: pod.namespace, container: container || undefined };
  return (
    <Page
      tabs={[
        { id: 'logs', name: 'Logs' },
        { id: 'describe', name: 'Describe' },
        { id: 'files', name: 'Files' },
        { id: 'inspect', name: 'Inspect' },
      ]}
      header={props.header(
        <>
          {pod.containers.length > 1 && (
            <div className="w-40">
              <Picker label="Container" value={container} options={[{ value: '', label: 'Every container' }, ...pod.containers.map((c) => ({ value: c, label: c }))]} onValueChange={setContainer} className="w-full" />
            </div>
          )}
          <Btn icon={SquareTerminal} disabled={pod.phase !== 'Running'} onClick={() => props.shell({ container: container || undefined })}>
            Shell
          </Btn>
          <ToolButton
            label="Delete"
            icon={Trash2}
            disabled={props.busy}
            onClick={async () => {
              if (await props.confirm(`Delete ${pod.name}?`, 'A pod a deployment owns comes back as a new one; one on its own is gone', 'Delete')) void props.act('deletePod', {}, true);
            }}
          />
        </>,
      )}
    >
      {(tab) =>
        tab === 'logs' ? (
          <LogView key={container} request={req} />
        ) : tab === 'describe' ? (
          <TextView request={{ op: 'describe', target, thing: 'kubePod', id: pod.name, namespace: pod.namespace }} />
        ) : tab === 'files' ? (
          pod.phase === 'Running' ? (
            <FilesView key={container} request={req} canCopy={false} />
          ) : (
            <Loading>Its files can be walked while it runs</Loading>
          )
        ) : (
          <InspectView request={{ target, thing: 'kubePod', id: pod.name, namespace: pod.namespace }} />
        )
      }
    </Page>
  );
}
