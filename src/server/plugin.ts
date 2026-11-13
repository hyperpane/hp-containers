// The server part's calls, apart from main.ts so the tests can make it with
// a test host.
//
// Calls: targets (the managers found here), snapshot (what one runs),
// action, inspect, describe, history (an image's layers), diskUsage, prune,
// run (an image), files and readFile (inside a container or a pod),
// copyToProject and download (out of a container), screen (a screen or tmux
// session's screen), shell (a Terminal window: a shell inside, or attached
// to a session).
// Subscriptions: watch (what a target runs, every 3 s while it changes),
// logs, stats and pull (as they come).
//
// Each group of them is a file of its own (calls/, subscriptions.ts); the
// managers are found in targets.ts. This puts them together.

import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { type Host, json } from '@hyperpane/sdk/server';
import { engineCalls } from './calls/engine.ts';
import { fileCalls } from './calls/files.ts';
import { terminalCalls } from './calls/terminals.ts';
import { thingCalls } from './calls/things.ts';
import type { Ctx } from './context.ts';
import { subscriptions } from './subscriptions.ts';
import { managers } from './targets.ts';
import { Runner, which } from './tools.ts';

export interface Options {
  /** Finds a tool (the tests give their stand-ins). */
  which?: (name: string) => string | null;
  /** How often a watched target is looked at again, in ms. */
  pollEvery?: number;
}

export function make(o: Options = {}) {
  return json((host: Host) => {
    const runner = new Runner((cmd: string, args: string[], so: SpawnOptions) => host.spawn(cmd, args, so) as ChildProcess);
    const find = o.which ?? ((name: string) => which(name, runner.env));
    const ctx: Ctx = { host, runner, pollEvery: o.pollEvery ?? 3000, ...managers(runner, find) };
    return {
      calls: { ...thingCalls(ctx), ...engineCalls(ctx), ...fileCalls(ctx), ...terminalCalls(ctx) },
      subscriptions: subscriptions(ctx),
    };
  });
}

export const plugin = make();
