// Terminals: screen (a screen or tmux session's screen, as text) and shell
// (a Terminal window: a shell inside a container or a pod, or attached to
// a session).

import { PluginError } from '@hyperpane/sdk/server';
import { container, name, one, only, said } from '../checks.ts';
import type { Calls, Ctx } from '../context.ts';

export function terminalCalls({ host, target }: Ctx): Calls {
  return {
    screen: async ({ target: id, id: session }) => {
      const f = await target(id);
      return said(async () => only(f, 'sessions', 'show a screen').screen(String(session)));
    },

    shell: async ({ project, target: id, id: thing, namespace, container: c }) => {
      if (typeof project !== 'string' || !project) throw new PluginError('Open a project to open a terminal in it.');
      const f = await target(id);
      const command = await said(async () => {
        if (f.kube) return f.kube.shell(f.t, name(thing), one(f.t, namespace), container(c));
        if (f.sessions) return f.sessions.attach(String(thing));
        return only(f, 'engine', 'open a shell').shell(f.t, name(thing));
      });
      return host.terminals(project).open({ command, title: `${thing} · ${f.t.kind}` });
    },
  };
}
