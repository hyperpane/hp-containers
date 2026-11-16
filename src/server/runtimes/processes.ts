// Process managers beside the containers: pm2 (its processes, their CPU,
// memory and restarts, and their logs), and screen and tmux (sessions to
// attach to in a terminal, see the screen of, or end).

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Action, Kind, Pm2Process, Snapshot, Target, TermSession } from '../../shared/index.ts';
import { type Runner, said } from '../tools.ts';

type Obj = Record<string, unknown>;

const target = (kind: Kind, name: string, ok: boolean, error: string | null, detail: string | null): Target => ({
  id: kind,
  kind,
  name,
  context: null,
  ok,
  error,
  detail,
  namespace: null,
});

function pm2Of(p: Obj): Pm2Process {
  const env = (p.pm2_env ?? {}) as Obj;
  const instances = Number(env.instances ?? 1);
  return {
    id: String(p.pm_id ?? env.pm_id ?? ''),
    name: String(p.name ?? env.name ?? ''),
    status: String(env.status ?? 'unknown'),
    pid: Number(p.pid) || null,
    cpu: Number((p.monit as Obj | undefined)?.cpu ?? 0),
    memory: Number((p.monit as Obj | undefined)?.memory ?? 0),
    restarts: Number(env.restart_time ?? 0),
    since: env.status === 'online' && Number(env.pm_uptime) ? Number(env.pm_uptime) : null,
    cwd: String(env.pm_cwd ?? ''),
    mode: env.exec_mode === 'cluster_mode' ? `cluster × ${instances}` : 'fork',
  };
}

/** `pm2 jlist` may print a banner (its first run) before the JSON. */
function pm2List(out: string): Obj[] {
  const at = out.indexOf('[');
  if (at < 0) return [];
  return JSON.parse(out.slice(at, out.lastIndexOf(']') + 1)) as Obj[];
}

export class Pm2 {
  readonly tool: string;
  readonly #runner: Runner;
  constructor(tool: string, runner: Runner) {
    this.tool = tool;
    this.#runner = runner;
  }

  async targets(): Promise<Target[]> {
    const r = await this.#runner.run(this.tool, ['jlist'], 15_000);
    if (r.code !== 0) return [target('pm2', 'pm2', false, `pm2 doesn’t answer: ${said(r)}`, null)];
    const v = await this.#runner.run(this.tool, ['--version'], 8000);
    return [target('pm2', 'pm2', true, null, v.code === 0 ? `pm2 ${v.stdout.trim().split('\n').at(-1)}` : null)];
  }

  async snapshot(t: Target): Promise<Snapshot> {
    const r = await this.#runner.run(this.tool, ['jlist'], 15_000);
    if (r.code !== 0) return { target: t.id, error: said(r) };
    try {
      return { target: t.id, error: null, processes: pm2List(r.stdout).map(pm2Of) };
    } catch {
      return { target: t.id, error: 'pm2’s list isn’t JSON.' };
    }
  }

  actionArgs(action: Action, id: string): string[] {
    const verbs: Partial<Record<Action, string>> = { pm2Start: 'start', pm2Stop: 'stop', pm2Restart: 'restart', pm2Reload: 'reload', pm2Delete: 'delete' };
    if (!verbs[action]) throw new Error(`pm2 can't ${action}.`);
    return [verbs[action]!, id];
  }

  async action(action: Action, id: string): Promise<void> {
    const r = await this.#runner.run(this.tool, this.actionArgs(action, id), 60_000);
    if (r.code !== 0) throw new Error(said(r));
  }

  async inspect(id: string): Promise<unknown> {
    const r = await this.#runner.run(this.tool, ['jlist'], 15_000);
    const found = pm2List(r.stdout).find((p) => String(p.pm_id) === id);
    if (!found) throw new Error(`pm2 has no process ${id}.`);
    return found;
  }

  logs(id: string): { cmd: string; args: string[] } {
    return { cmd: this.tool, args: ['logs', id, '--raw', '--lines', '500'] };
  }
}

/** `screen -ls`: `\t12345.work\t(13/11/26 03:00:00)\t(Detached)`. */
export function screensOf(out: string): TermSession[] {
  const list: TermSession[] = [];
  for (const line of out.split('\n')) {
    const m = /^\s+(\d+)\.(\S+)\s+(?:\(([^)]*\d[^)]*)\)\s+)?\((Attached|Detached|Multi[^)]*)\)/.exec(line);
    if (!m) continue;
    list.push({ id: `${m[1]}.${m[2]}`, name: m[2], attached: !/detached/i.test(m[4]), windows: null, created: m[3] ? Date.parse(m[3]) || null : null });
  }
  return list;
}

/** tmux's `#{session_name}\t#{session_windows}\t#{session_attached}\t#{session_created}`. */
function tmuxOf(out: string): TermSession[] {
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, windows, attached, created] = line.split('\t');
      return { id: name, name, attached: Number(attached) > 0, windows: Number(windows) || null, created: Number(created) ? Number(created) * 1000 : null };
    });
}

const SCREEN_ID = /^\d+\.[A-Za-z0-9_.-]+$/;
const TMUX_NAME = /^[A-Za-z0-9_][A-Za-z0-9_ .@+-]{0,99}$/;

export class Sessions {
  readonly kind: 'screen' | 'tmux';
  readonly tool: string;
  readonly #runner: Runner;
  constructor(kind: 'screen' | 'tmux', tool: string, runner: Runner) {
    this.kind = kind;
    this.tool = tool;
    this.#runner = runner;
  }

  #check(id: string): string {
    if (!(this.kind === 'screen' ? SCREEN_ID : TMUX_NAME).test(id)) throw new Error(`“${id}” isn’t a ${this.kind} session.`);
    return id;
  }

  async targets(): Promise<Target[]> {
    const v = await this.#runner.run(this.tool, this.kind === 'tmux' ? ['-V'] : ['-v'], 8000);
    return [target(this.kind, this.kind, true, null, (v.stdout || v.stderr).trim().split('\n')[0] || null)];
  }

  async snapshot(t: Target): Promise<Snapshot> {
    if (this.kind === 'screen') {
      // It exits 1 even when it lists some.
      const r = await this.#runner.run(this.tool, ['-ls'], 10_000);
      return { target: t.id, error: null, sessions: screensOf(r.stdout) };
    }
    const r = await this.#runner.run(
      this.tool,
      ['list-sessions', '-F', '#{session_name}\t#{session_windows}\t#{session_attached}\t#{session_created}'],
      10_000,
    );
    // No server running: no sessions.
    if (r.code !== 0) return { target: t.id, error: /no server running|error connecting/i.test(r.stderr) ? null : said(r), sessions: [] };
    return { target: t.id, error: null, sessions: tmuxOf(r.stdout) };
  }

  killArgs(id: string): string[] {
    return this.kind === 'screen' ? ['-S', this.#check(id), '-X', 'quit'] : ['kill-session', '-t', `=${this.#check(id)}`];
  }

  async action(action: Action, id: string): Promise<void> {
    if (action !== 'sessionKill') throw new Error(`${this.kind} can't ${action}.`);
    const r = await this.#runner.run(this.tool, this.killArgs(id), 15_000);
    if (r.code !== 0) throw new Error(said(r));
  }

  /** What's on its screen now, with what scrolled up (1000 lines). */
  async screen(id: string): Promise<string> {
    this.#check(id);
    if (this.kind === 'tmux') {
      const r = await this.#runner.run(this.tool, ['capture-pane', '-p', '-J', '-t', `=${id}:`, '-S', '-1000'], 15_000);
      if (r.code !== 0) throw new Error(said(r));
      return r.stdout;
    }
    const dir = await mkdtemp(path.join(os.tmpdir(), 'screen-'));
    const file = path.join(dir, 'copy.txt');
    try {
      const r = await this.#runner.run(this.tool, ['-S', id, '-X', 'hardcopy', '-h', file], 15_000);
      if (r.code !== 0) throw new Error(said(r));
      // screen writes it a moment after it answers.
      for (let i = 0; i < 20; i++) {
        const text = await readFile(file, 'utf8').catch(() => null);
        if (text !== null) return text.replace(/\s+$/, '\n');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('screen didn’t write its screen.');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** What a terminal types to attach. */
  attach(id: string): string {
    this.#check(id);
    return this.kind === 'screen' ? `screen -x ${id}` : `tmux attach -t "=${id}"`;
  }
}
