// What each list is given by List: the target and what it runs, the search,
// and the actions on a row (with which of them are under way).

import type { Action, Snapshot, Target } from '../../shared/index.ts';
import type { Host, confirmer, useCall } from '../lib/calls.ts';
import type { Open } from '../lib/open.ts';

export interface ListProps {
  target: Target;
  snap: Snapshot;
  /** Room for every column. */
  wide: boolean;
  /** Every Kubernetes namespace is shown (names say theirs). */
  all: boolean;
  host: Host;
  call: ReturnType<typeof useCall>;
  confirm: ReturnType<typeof confirmer>;
  filter: string;
  setFilter(v: string): void;
  /** Whether any of these has what's searched for. */
  match(...s: (string | number | null | undefined)[]): boolean;
  act(action: Action, id: string, extra?: Record<string, unknown>): Promise<void>;
  /** Whether that action on it is under way. */
  is(action: Action, id: string): boolean;
  shell(id: string, extra?: Record<string, unknown>): void;
  onOpen(o: Open): void;
}
