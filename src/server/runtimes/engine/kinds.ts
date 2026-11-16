// Docker, Podman and nerdctl by name, and what a failed command of theirs
// means, for people.

import type { Kind } from '../../../shared/index.ts';

export type EngineKind = Extract<Kind, 'docker' | 'podman' | 'nerdctl'>;

export const NAMES: Record<EngineKind, string> = { docker: 'Docker', podman: 'Podman', nerdctl: 'nerdctl' };

/** What a failed command means, for people. */
export function engineError(kind: EngineKind, text: string): string {
  if (/cannot connect to the docker daemon|is the docker daemon running|error during connect/i.test(text))
    return 'Docker isn’t running here: start Docker Desktop (or OrbStack, Colima, the Docker service).';
  if (/cannot connect to podman|podman machine|unable to connect to podman/i.test(text)) return 'Podman isn’t running: start it (podman machine start).';
  if (/permission denied.*(docker|containerd)\.sock/i.test(text))
    return `${NAMES[kind]} refuses this user: add it to the docker group, or use rootless ${NAMES[kind]}.`;
  if (/executable file not found|no such file or directory.*(sh|stat)|OCI runtime exec failed/i.test(text))
    return 'It has no shell (or no stat) to list its files: open a file by its path instead.';
  return text;
}
