// Running the managers' command lines: found on the server's PATH and where
// they install themselves (the server, started by the app, may have a short
// PATH), each run with a time limit and its output kept.

import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type Spawn = (cmd: string, args: string[], o: SpawnOptions) => ChildProcess;

/** Where container tools live besides PATH. */
function extraDirs(home = os.homedir()): string[] {
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files';
    return [path.join(pf, 'Docker', 'Docker', 'resources', 'bin'), path.join(pf, 'RedHat', 'Podman'), path.join(home, '.rd', 'bin')];
  }
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/Applications/Docker.app/Contents/Resources/bin',
    path.join(home, '.docker', 'bin'),
    path.join(home, '.orbstack', 'bin'),
    path.join(home, '.rd', 'bin'),
    '/opt/podman/bin',
    '/snap/bin',
    path.join(home, '.local', 'bin'),
    // Where pm2 (an npm package) and the Node it needs often are.
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.volta', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, 'Library', 'pnpm'),
    path.join(home, '.local', 'share', 'pnpm'),
    ...nvmBins(home),
  ];
}

/** nvm's Node versions' bin folders, newest first. */
function nvmBins(home: string): string[] {
  const dir = path.join(home, '.nvm', 'versions', 'node');
  try {
    return readdirSync(dir)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => path.join(dir, v, 'bin'));
  } catch {
    return [];
  }
}

/** PATH with those added (after what's there). */
function searchPath(env: NodeJS.ProcessEnv = process.env): string {
  const have = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  return [...have, ...extraDirs().filter((d) => !have.includes(d))].join(path.delimiter);
}

/** A tool's full path, or null. */
export function which(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of searchPath(env).split(path.delimiter)) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      if (existsSync(file)) return file;
    }
  }
  return null;
}

export interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}

export class Runner {
  readonly spawn: Spawn;
  readonly env: NodeJS.ProcessEnv;
  constructor(spawn: Spawn, env: NodeJS.ProcessEnv = process.env) {
    this.spawn = spawn;
    this.env = { ...env, PATH: searchPath(env) };
  }

  /** Runs it to the end (or `timeout` ms), its output kept (the last 16 MB). */
  run(cmd: string, args: string[], timeout = 20_000): Promise<Result> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let child: ChildProcess;
      try {
        child = this.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: this.env });
      } catch (e) {
        resolve({ code: null, stdout: '', stderr: (e as Error).message });
        return;
      }
      const timer = setTimeout(() => {
        stderr += `\n${path.basename(cmd)} took longer than ${timeout / 1000} s.`;
        child.kill();
      }, timeout);
      child.stdout?.on('data', (d: Buffer) => (stdout = (stdout + d.toString('utf8')).slice(-16_000_000)));
      child.stderr?.on('data', (d: Buffer) => (stderr = (stderr + d.toString('utf8')).slice(-64_000)));
      child.on('error', (e) => {
        clearTimeout(timer);
        resolve({ code: null, stdout, stderr: stderr || e.message });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
    });
  }
}

/** The last line of what a tool said on failing. */
export function said(r: Result): string {
  const lines = r.stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return (lines.at(-1) ?? (r.stdout.trim().split('\n').at(-1) || `It failed (exit code ${r.code}).`)).slice(0, 400);
}

/** One JSON value per line (Docker's `{{json .}}`), or a JSON array. */
export function jsonLines(text: string): unknown[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith('[')) return JSON.parse(t) as unknown[];
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
