// The subscriptions: watch (what a target runs, every few seconds while it
// changes), and logs, stats and pull (as they come, from a command followed
// until it ends or the window stops listening).

import { type Out, PluginError } from '@hyperpane/sdk/server';
import type { Snapshot } from '../shared/index.ts';
import { container, name, one, only, said } from './checks.ts';
import type { Ctx, Subscriptions } from './context.ts';
import { statsObjects, statsOf } from './runtimes/engine/parse.ts';
import type { Runner } from './tools.ts';

/** Runs a command and sends what it prints ({ text }) until it ends or
 * the window stops listening. */
function follow(runner: Runner, out: Out, run: { cmd: string; args: string[] }, each?: (text: string) => void): Promise<void> {
  const child = runner.spawn(run.cmd, run.args, { stdio: ['ignore', 'pipe', 'pipe'], env: runner.env });
  return new Promise<void>((resolve, reject) => {
    let err = '';
    const send = (d: Buffer) => (each ? each(d.toString('utf8')) : out.emit({ text: d.toString('utf8') }));
    child.stdout?.on('data', send);
    child.stderr?.on('data', (d: Buffer) => {
      err = (err + d.toString('utf8')).slice(-4000);
      if (!each) send(d);
    });
    out.signal.addEventListener('abort', () => child.kill(), { once: true });
    child.on('error', (e) => reject(new PluginError(e.message)));
    child.on('close', (code) => {
      if (out.signal.aborted || code === 0) resolve();
      else reject(new PluginError(err.trim().split('\n').at(-1) || `It stopped (exit code ${code}).`));
    });
  });
}

export function subscriptions({ runner, target, snapshot, pollEvery }: Ctx): Subscriptions {
  return {
    watch: async ({ target: id, namespace }, out) => {
      let last = '';
      while (!out.signal.aborted) {
        let s: Snapshot;
        try {
          s = await snapshot(id, namespace);
        } catch (e) {
          s = { target: String(id), error: (e as Error).message };
        }
        const key = JSON.stringify(s);
        if (key !== last && !out.signal.aborted) {
          last = key;
          out.emit(s);
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, pollEvery);
          out.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
    },

    logs: async ({ target: id, id: thing, namespace, container: c, timestamps }, out) => {
      const f = await target(id);
      const run = await said(async () => {
        if (f.kube) return f.kube.logs(f.t, name(thing), one(f.t, namespace), container(c));
        if (f.pm2) {
          if (!/^\d{1,6}$/.test(String(thing))) throw new PluginError('That isn’t a pm2 process.');
          return f.pm2.logs(String(thing));
        }
        return only(f, 'engine', 'show logs').logs(f.t, name(thing), !!timestamps);
      });
      await follow(runner, out, run);
    },

    // Readings as they come: { stats }.
    stats: async ({ target: id, id: thing }, out) => {
      const f = await target(id);
      const engine = only(f, 'engine', 'show stats');
      let buf = '';
      await follow(runner, out, engine.stats(f.t, name(thing)), (text) => {
        buf = (buf + text).slice(-20_000);
        const found = statsObjects(buf);
        if (!found.length) return;
        buf = buf.slice(buf.lastIndexOf('}') + 1);
        out.emit({ stats: statsOf(found.at(-1)!) });
      });
    },

    pull: async ({ target: id, image }, out) => {
      const f = await target(id);
      const engine = only(f, 'engine', 'pull images');
      await follow(runner, out, await said(async () => engine.pull(f.t, String(image))));
    },
  };
}
