// What each page is given by Detail: the thing opened, what the target runs
// now (the thing as it is), its header, and the actions on it.

import type { Action, Snapshot, Target } from '../../shared/index.ts';
import type { Host, confirmer } from '../lib/calls.ts';
import type { Open } from '../lib/open.ts';

export interface DetailProps {
  target: Target;
  snap: Snapshot;
  open: Open;
  onBack(): void;
  onOpen(o: Open): void;
  host: Host;
  confirm: ReturnType<typeof confirmer>;
  /** An action under way. */
  busy: boolean;
  /** An action on the thing (and back to the list, when it's gone). */
  act(action: Action, extra?: Record<string, unknown>, back?: boolean): Promise<void>;
  /** A terminal with a shell in it (or attached to it). */
  shell(extra?: Record<string, unknown>): void;
  /** The page's header: its dot, the line under its name, its actions. */
  header(dot: string | null, sub: React.ReactNode, actions: React.ReactNode): React.ReactNode;
}
