// The managers on this server, found as they're asked for: each one's
// targets (a Docker context, Podman, a kubectl context, pm2, a session
// manager), the ones not installed (listed last, saying how to get them),
// a target by its id with the manager that runs it, and what it runs now.

import { PluginError } from '@hyperpane/sdk/server';
import { MANAGERS, type Snapshot, type Target } from '../shared/index.ts';
import { ns } from './checks.ts';
import { Engine } from './runtimes/engine/engine.ts';
import type { EngineKind } from './runtimes/engine/kinds.ts';
import { Kube } from './runtimes/kube.ts';
import { Pm2, Sessions } from './runtimes/processes.ts';
import type { Runner } from './tools.ts';

/** A target, with the manager that runs it. */
export type Found = { t: Target; engine?: Engine; kube?: Kube; pm2?: Pm2; sessions?: Sessions };

export interface Managers {
  targets(): Promise<Target[]>;
  target(id: unknown): Promise<Found>;
  snapshot(id: unknown, namespace: unknown): Promise<Snapshot>;
}

/** The managers `find` finds, run through `runner`. */
export function managers(runner: Runner, find: (name: string) => string | null): Managers {
  let known = new Map<string, Target>();

  function tools() {
    const engines: Engine[] = [];
    for (const kind of ['docker', 'podman', 'nerdctl'] as EngineKind[]) {
      const tool = find(kind);
      if (tool) engines.push(new Engine(kind, tool, runner));
    }
    const kubectl = find('kubectl');
    const pm2 = find('pm2');
    const sessions: Sessions[] = [];
    for (const kind of ['tmux', 'screen'] as const) {
      const tool = find(kind);
      if (tool) sessions.push(new Sessions(kind, tool, runner));
    }
    return { engines, kube: kubectl ? new Kube(kubectl, runner) : null, pm2: pm2 ? new Pm2(pm2, runner) : null, sessions };
  }

  async function targets(): Promise<Target[]> {
    const { engines, kube, pm2, sessions } = tools();
    const lists = await Promise.all([
      ...engines.map((e) => e.targets()),
      kube ? kube.targets() : Promise.resolve([]),
      pm2 ? pm2.targets() : Promise.resolve([]),
      ...sessions.map((s) => s.targets()),
    ]);
    const all = lists.flat();
    known = new Map(all.map((t) => [t.id, t]));
    // The ones not here: listed last, saying how to get them.
    const missing = MANAGERS.filter((m) => !all.some((t) => t.kind === m.kind)).map(
      (m): Target => ({ id: `missing:${m.kind}`, kind: m.kind, name: m.name, context: null, ok: false, error: `${m.name} isn’t on this server. ${m.install}`, detail: 'Not installed', namespace: null, installed: false }),
    );
    return [...all, ...missing];
  }

  async function target(id: unknown): Promise<Found> {
    if (typeof id !== 'string') throw new PluginError('Which manager?');
    if (!known.has(id)) await targets();
    const t = known.get(id);
    if (!t) throw new PluginError(`${id} isn’t on this server (any more).`);
    const { engines, kube, pm2, sessions } = tools();
    const gone = () => new PluginError(`${t.kind} isn’t on this server any more.`);
    if (t.kind === 'kubernetes') {
      if (!kube) throw gone();
      return { t, kube };
    }
    if (t.kind === 'pm2') {
      if (!pm2) throw gone();
      return { t, pm2 };
    }
    if (t.kind === 'screen' || t.kind === 'tmux') {
      const s = sessions.find((x) => x.kind === t.kind);
      if (!s) throw gone();
      return { t, sessions: s };
    }
    const engine = engines.find((e) => e.kind === t.kind);
    if (!engine) throw gone();
    return { t, engine };
  }

  async function snapshot(id: unknown, namespace: unknown): Promise<Snapshot> {
    const f = await target(id);
    if (f.kube) return f.kube.snapshot(f.t, ns(f.t, namespace));
    if (f.pm2) return f.pm2.snapshot(f.t);
    if (f.sessions) return f.sessions.snapshot(f.t);
    return f.engine!.snapshot(f.t);
  }

  return { targets, target, snapshot };
}
