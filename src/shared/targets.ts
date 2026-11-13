// The managers a server may have, and how each one is named: a target is
// one of them to look at (a Docker context, Podman, a kubectl context…).

export type Kind = 'docker' | 'podman' | 'nerdctl' | 'kubernetes' | 'pm2' | 'screen' | 'tmux';

/** Managers of processes rather than containers. */
export const PROCESS_KINDS: Kind[] = ['pm2', 'screen', 'tmux'];

/** One container manager to look at: a Docker context, Podman, nerdctl, or a
 * kubectl context. */
export interface Target {
  /** `docker:desktop-linux`, `podman`, `kubernetes:prod`. */
  id: string;
  kind: Kind;
  /** As shown: `Docker · desktop-linux`. */
  name: string;
  /** The Docker or kubectl context it names on every command. */
  context: string | null;
  /** Whether it answers now. */
  ok: boolean;
  /** Why not (`Docker isn't running`). */
  error: string | null;
  /** Its version, or the cluster's server. */
  detail: string | null;
  /** A kubectl context's own namespace (null for the others). */
  namespace: string | null;
  /** False for one that isn't on the server: listed, with how to get it. */
  installed?: boolean;
}

/** Each manager's name, and how to install it. */
export const MANAGERS: { kind: Kind; tool: string; name: string; install: string }[] = [
  { kind: 'docker', tool: 'docker', name: 'Docker', install: 'Install Docker Desktop, OrbStack, Colima or Rancher Desktop (or the Docker engine).' },
  { kind: 'podman', tool: 'podman', name: 'Podman', install: 'Install Podman (brew install podman, then podman machine init; or your system’s package).' },
  { kind: 'nerdctl', tool: 'nerdctl', name: 'nerdctl', install: 'Install nerdctl (it comes with Rancher Desktop and Lima).' },
  { kind: 'kubernetes', tool: 'kubectl', name: 'Kubernetes', install: 'Install kubectl (brew install kubectl, or it comes with Docker Desktop).' },
  { kind: 'pm2', tool: 'pm2', name: 'pm2', install: 'Install pm2: npm install -g pm2.' },
  { kind: 'tmux', tool: 'tmux', name: 'tmux', install: 'Install tmux (brew install tmux, apt install tmux).' },
  { kind: 'screen', tool: 'screen', name: 'screen', install: 'Install screen (brew install screen, apt install screen).' },
];
