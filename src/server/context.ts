// What the calls and subscriptions share: the host, the runner of command
// lines, the managers, and how often a watched target is looked at again.

import type { Host, JsonSpec } from '@hyperpane/sdk/server';
import type { Managers } from './targets.ts';
import type { Runner } from './tools.ts';

export interface Ctx extends Managers {
  host: Host;
  runner: Runner;
  /** In ms. */
  pollEvery: number;
}

export type Calls = NonNullable<JsonSpec['calls']>;
export type Subscriptions = NonNullable<JsonSpec['subscriptions']>;
