// How a thing's state shows: the dot before its name (by a container's,
// pm2 process's or pod's state), and a port mapping as an address to open.

export const DOT: Record<string, string> = {
  running: 'bg-[var(--ansi-2)]',
  online: 'bg-[var(--ansi-2)]',
  restarting: 'bg-[var(--ansi-3)] animate-pulse',
  launching: 'bg-[var(--ansi-3)] animate-pulse',
  paused: 'bg-[var(--ansi-3)]',
  created: 'bg-[var(--node-muted)]',
  stopped: 'bg-[var(--node-muted)] opacity-50',
  exited: 'bg-[var(--node-muted)] opacity-50',
  dead: 'bg-[var(--ansi-1)]',
  errored: 'bg-[var(--ansi-1)]',
};

export function kubeDot(phase: string): string {
  if (phase === 'Running') return DOT.running;
  if (phase === 'Succeeded') return DOT.exited;
  if (['Pending', 'Terminating', 'ContainerCreating', 'PodInitializing'].includes(phase)) return DOT.restarting;
  return DOT.dead;
}

/** `8080->80/tcp` (or `127.0.0.1:8080->80/tcp`) as the local address to open. */
export function openable(port: string): string | null {
  const m = /^(?:([\d.]+):)?(\d+)->\d+\/tcp$/.exec(port);
  return m ? `http://${m[1] && m[1] !== '0.0.0.0' ? m[1] : 'localhost'}:${m[2]}` : null;
}
