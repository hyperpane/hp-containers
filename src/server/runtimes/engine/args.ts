// `run`'s command line, built from what the window asks for: every part
// checked before it becomes an argument.

import type { RunSpec } from '../../../shared/index.ts';

const PORT = /^(\[?[0-9a-fA-F:.]*\]?:)?(\d{1,5}(-\d{1,5})?:)?\d{1,5}(-\d{1,5})?(\/(tcp|udp|sctp))?$/;
const ENV = /^[A-Za-z_][A-Za-z0-9_.]*(=.*)?$/s;
const RESTART = /^(no|always|unless-stopped|on-failure(:\d{1,4})?)$/;
export const IMAGE = /^[a-z0-9][a-z0-9._/:@-]{0,254}$/i;

/** `docker run`'s arguments for a spec, each part checked. */
export function runArgs(spec: RunSpec): string[] {
  const args = ['run', '-d'];
  if (!spec || typeof spec.image !== 'string' || !IMAGE.test(spec.image)) throw new Error('Say which image to run (nginx, nginx:1.27, ghcr.io/owner/app:tag).');
  if (spec.name) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(spec.name)) throw new Error(`“${spec.name}” can’t be a container’s name: letters, digits, _ . -`);
    args.push('--name', spec.name);
  }
  for (const p of spec.ports ?? []) {
    if (!PORT.test(p.trim())) throw new Error(`“${p}” isn’t a port mapping (8080:80, 127.0.0.1:5432:5432, 53:53/udp).`);
    args.push('-p', p.trim());
  }
  for (const e of spec.env ?? []) {
    if (!ENV.test(e)) throw new Error(`“${e}” isn’t KEY=value.`);
    args.push('-e', e);
  }
  for (const v of spec.volumes ?? []) {
    const vol = v.trim();
    if (!vol || vol.startsWith('-') || !vol.includes(':')) throw new Error(`“${v}” isn’t a volume (name:/path, /host/path:/path, with :ro to read only).`);
    args.push('-v', vol);
  }
  if (spec.restart) {
    if (!RESTART.test(spec.restart)) throw new Error('Restart is no, always, unless-stopped or on-failure.');
    args.push('--restart', spec.restart);
  }
  args.push(spec.image);
  for (const w of spec.command ?? []) args.push(String(w));
  return args;
}
