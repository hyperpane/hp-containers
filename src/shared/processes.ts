// Process managers beside the containers: pm2's processes, and screen and
// tmux sessions.

/** A process pm2 runs. */
export interface Pm2Process {
  /** pm2's id (`0`). */
  id: string;
  name: string;
  /** online, stopped, errored, launching… */
  status: string;
  pid: number | null;
  /** Percent of one CPU. */
  cpu: number;
  /** Bytes. */
  memory: number;
  restarts: number;
  /** Since when it runs (ms since 1970). */
  since: number | null;
  cwd: string;
  /** fork or cluster, and how many. */
  mode: string;
}

/** A screen or tmux session. */
export interface TermSession {
  /** What names it: `12345.work` for screen, the name for tmux. */
  id: string;
  name: string;
  attached: boolean;
  windows: number | null;
  created: number | null;
}
