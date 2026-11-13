// The calls every manager answers: targets (the managers found here),
// snapshot (what one runs), action (on a thing), inspect, and describe
// (Kubernetes').

import { PluginError } from '@hyperpane/sdk/server';
import type { Action, Thing } from '../../shared/index.ts';
import { name, one, only, said } from '../checks.ts';
import type { Calls, Ctx } from '../context.ts';

const ENGINE_ACTIONS: Action[] = [
  'start',
  'stop',
  'restart',
  'pause',
  'unpause',
  'kill',
  'remove',
  'removeImage',
  'removeVolume',
  'removeNetwork',
  'composeStart',
  'composeStop',
  'composeRestart',
  'composeDown',
  'podStart',
  'podStop',
  'podRemove',
];
const KUBE_ACTIONS: Action[] = ['deletePod', 'rolloutRestart', 'scale'];

export function thingCalls({ targets, target, snapshot }: Ctx): Calls {
  return {
    targets: () => targets(),
    snapshot: ({ target: id, namespace }) => snapshot(id, namespace),

    action: async ({ target: id, action, id: thing, namespace, replicas }) => {
      const f = await target(id);
      const a = String(action) as Action;
      await said(async () => {
        if (f.kube) {
          if (!KUBE_ACTIONS.includes(a)) throw new PluginError(`Kubernetes can’t ${a} here.`);
          await f.kube.action(f.t, a, name(thing), one(f.t, namespace), replicas === undefined ? undefined : Number(replicas));
        } else if (f.pm2) {
          if (!/^\d{1,6}$/.test(String(thing))) throw new PluginError('That isn’t a pm2 process.');
          await f.pm2.action(a, String(thing));
        } else if (f.sessions) {
          await f.sessions.action(a, String(thing));
        } else {
          if (!ENGINE_ACTIONS.includes(a)) throw new PluginError(`${f.t.name} can’t ${a}.`);
          await f.engine!.action(f.t, a, name(thing));
        }
      });
      return null;
    },

    inspect: async ({ target: id, thing, id: what, namespace }) => {
      const f = await target(id);
      return said(async () => {
        if (f.kube) return f.kube.inspect(f.t, thing as Thing, name(what), one(f.t, namespace));
        if (f.pm2) return f.pm2.inspect(String(what));
        return only(f, 'engine', 'inspect').inspect(f.t, thing as Thing, name(what));
      });
    },

    describe: async ({ target: id, thing, id: what, namespace }) => {
      const f = await target(id);
      return said(async () => only(f, 'kube', 'describe').describe(f.t, thing as Thing, name(what), one(f.t, namespace)));
    },
  };
}
