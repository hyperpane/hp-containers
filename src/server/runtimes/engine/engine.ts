// Docker, Podman and nerdctl: one command line each, alike enough to share
// this. Docker's (and nerdctl's) `--format '{{json .}}'` gives one object a
// line; Podman's `--format json` gives an array, with its own names for
// things. Both come out as the same shapes.
//
// The command lines, their output's shapes and their errors are beside this
// (args.ts, parse.ts, kinds.ts); this is the manager itself.

import path from 'node:path';
import type { Action, DiskUsage, FileContent, FileEntry, Layer, PodmanPod, Prune, RunSpec, Snapshot, Target, Thing, Volume } from '../../../shared/index.ts';
import { firstEntry } from '../../tar.ts';
import { type Runner, jsonLines, said } from '../../tools.ts';
import { LIST_SCRIPT, MAX_TEXT, checkedPath, contentOf, entriesOf } from '../files.ts';
import { IMAGE, runArgs } from './args.ts';
import { type EngineKind, NAMES, engineError } from './kinds.ts';
import { containerOf, imageOf, networkOf, pick, size, str } from './parse.ts';

export class Engine {
  readonly kind: EngineKind;
  readonly tool: string;
  readonly #runner: Runner;
  constructor(kind: EngineKind, tool: string, runner: Runner) {
    this.kind = kind;
    this.tool = tool;
    this.#runner = runner;
  }

  get label(): string {
    return NAMES[this.kind];
  }

  /** Its arguments for a target: Docker's context first. */
  args(t: Target, args: string[]): string[] {
    return this.kind === 'docker' && t.context ? ['--context', t.context, ...args] : args;
  }

  #json(): string[] {
    return this.kind === 'podman' ? ['--format', 'json'] : ['--format', '{{json .}}'];
  }

  async #ok(t: Target, args: string[], timeout = 30_000): Promise<string> {
    const r = await this.#runner.run(this.tool, this.args(t, args), timeout);
    if (r.code !== 0) throw new Error(engineError(this.kind, said(r)));
    return r.stdout;
  }

  /** Its targets: each Docker context, or the one Podman or nerdctl. */
  async targets(): Promise<Target[]> {
    const base = { kind: this.kind, error: null, detail: null, namespace: null };
    let contexts: { name: string; current: boolean }[] = [{ name: '', current: true }];
    if (this.kind === 'docker') {
      const r = await this.#runner.run(this.tool, ['context', 'ls', '--format', '{{json .}}'], 8000);
      if (r.code === 0) {
        const list = jsonLines(r.stdout) as Record<string, unknown>[];
        if (list.length) contexts = list.map((c) => ({ name: str(c.Name), current: c.Current === true || c.Current === 'true' }));
      }
    }
    contexts.sort((a, b) => Number(b.current) - Number(a.current));
    return Promise.all(
      contexts.map(async ({ name }) => {
        const t: Target = { ...base, id: name ? `${this.kind}:${name}` : this.kind, name: name ? `${NAMES[this.kind]} · ${name}` : NAMES[this.kind], context: name || null, ok: false };
        const r = await this.#runner.run(this.tool, this.args(t, ['version', '--format', this.kind === 'podman' ? '{{.Server.Version}}' : '{{json .Server.Version}}']), 8000);
        const version = r.stdout.trim().replace(/^"|"$/g, '');
        if (r.code === 0 && version && version !== 'null') return { ...t, ok: true, detail: `${NAMES[this.kind]} ${version}` };
        return { ...t, error: engineError(this.kind, said(r)) };
      }),
    );
  }

  async snapshot(t: Target): Promise<Snapshot> {
    const ps = await this.#runner.run(this.tool, this.args(t, ['ps', '-a', ...this.#json()]));
    if (ps.code !== 0) return { target: t.id, error: engineError(this.kind, said(ps)) };
    const [images, volumes, networks, pods] = await Promise.all([
      this.#runner.run(this.tool, this.args(t, ['images', ...this.#json()])),
      this.#runner.run(this.tool, this.args(t, ['volume', 'ls', ...this.#json()])),
      this.#runner.run(this.tool, this.args(t, ['network', 'ls', ...this.#json()])),
      this.kind === 'podman' ? this.#runner.run(this.tool, ['pod', 'ps', '--format', 'json']) : null,
    ]);
    const parse = <T>(r: { code: number | null; stdout: string } | null, f: (r: Record<string, unknown>) => T): T[] => {
      if (!r || r.code !== 0) return [];
      try {
        return (jsonLines(r.stdout) as Record<string, unknown>[]).map(f);
      } catch {
        return [];
      }
    };
    const containers = parse(ps, (r) => containerOf(this.kind, r));
    const out: Snapshot = {
      target: t.id,
      error: null,
      containers: containers.map(({ mounts: _, ...c }) => c),
      images: parse(images, (r) => imageOf(this.kind, r)),
      volumes: parse(volumes, (r): Volume => {
        const name = str(pick(r, 'Name', 'name'));
        return {
          name,
          driver: str(pick(r, 'Driver', 'driver')),
          mountpoint: str(pick(r, 'Mountpoint', 'mountpoint')),
          usedBy: containers.filter((c) => c.mounts.includes(name)).map((c) => c.name),
        };
      }),
      networks: parse(networks, networkOf),
    };
    if (pods) out.pods = parse(pods, (r): PodmanPod => ({ id: str(r.Id).slice(0, 12), name: str(r.Name), status: str(r.Status), containers: Array.isArray(r.Containers) ? r.Containers.length : 0 }));
    return out;
  }

  /** The command line for an action. */
  actionArgs(t: Target, action: Action, id: string): string[] {
    const simple: Partial<Record<Action, string[]>> = {
      start: ['start', id],
      stop: ['stop', id],
      restart: ['restart', id],
      pause: ['pause', id],
      unpause: ['unpause', id],
      kill: ['kill', id],
      remove: ['rm', '-f', id],
      removeImage: ['rmi', id],
      removeVolume: ['volume', 'rm', id],
      removeNetwork: ['network', 'rm', id],
      composeStart: ['compose', '-p', id, 'start'],
      composeStop: ['compose', '-p', id, 'stop'],
      composeRestart: ['compose', '-p', id, 'restart'],
      composeDown: ['compose', '-p', id, 'down'],
    };
    if (this.kind === 'podman') Object.assign(simple, { podStart: ['pod', 'start', id], podStop: ['pod', 'stop', id], podRemove: ['pod', 'rm', '-f', id] });
    const args = simple[action];
    if (!args) throw new Error(`${NAMES[this.kind]} can't ${action}.`);
    return this.args(t, args);
  }

  async action(t: Target, action: Action, id: string): Promise<void> {
    const r = await this.#runner.run(this.tool, this.actionArgs(t, action, id), 120_000);
    if (r.code !== 0) throw new Error(engineError(this.kind, said(r)));
  }

  /** Everything the manager knows about a thing. */
  async inspect(t: Target, thing: Thing, id: string): Promise<unknown> {
    const sub: Partial<Record<Thing, string[]>> = {
      container: ['container', 'inspect', id],
      image: ['image', 'inspect', id],
      volume: ['volume', 'inspect', id],
      network: ['network', 'inspect', id],
      pod: ['pod', 'inspect', id],
    };
    const args = sub[thing];
    if (!args) throw new Error(`${NAMES[this.kind]} has no ${thing}s.`);
    const list = JSON.parse(await this.#ok(t, args)) as unknown;
    return Array.isArray(list) ? list[0] : list;
  }

  async history(t: Target, id: string): Promise<Layer[]> {
    const out = await this.#ok(t, ['history', '--no-trunc', ...this.#json(), id]);
    return (jsonLines(out) as Record<string, unknown>[]).map((r) => {
      const bytes = r.size ?? r.Size;
      const created = pick(r, 'CreatedSince', 'created', 'CreatedAt');
      return {
        id: str(pick(r, 'ID', 'id')).replace(/^sha256:/, '').slice(0, 12),
        created: typeof created === 'string' && /^\d{4}-/.test(created) ? created.slice(0, 10) : str(created),
        createdBy: str(pick(r, 'CreatedBy', 'createdBy')).replace(/^\/bin\/sh -c #\(nop\)\s*/, '').trim(),
        size: typeof bytes === 'number' ? size(bytes) : str(bytes),
        comment: str(pick(r, 'Comment', 'comment')),
      };
    });
  }

  async diskUsage(t: Target): Promise<DiskUsage[]> {
    const out = await this.#ok(t, ['system', 'df', ...this.#json()]);
    return (jsonLines(out) as Record<string, unknown>[]).map((r) => {
      const sz = pick(r, 'Size', 'size');
      return {
        type: str(pick(r, 'Type', 'type')),
        total: Number(pick(r, 'TotalCount', 'Total', 'total') ?? 0),
        active: Number(pick(r, 'Active', 'active') ?? 0),
        size: typeof sz === 'number' ? size(sz) : str(sz),
        reclaimable: str(pick(r, 'Reclaimable', 'reclaimable')),
      };
    });
  }

  pruneArgs(t: Target, what: Prune): string[] {
    const args: Record<Prune, string[]> = {
      containers: ['container', 'prune', '-f'],
      images: ['image', 'prune', '-f'],
      allImages: ['image', 'prune', '-a', '-f'],
      volumes: ['volume', 'prune', '-f'],
      networks: ['network', 'prune', '-f'],
      buildCache: this.kind === 'podman' ? ['system', 'prune', '--build', '-f'] : ['builder', 'prune', '-f'],
      system: ['system', 'prune', '-f'],
    };
    if (!args[what]) throw new Error(`There's no “${what}” to clean up.`);
    return this.args(t, args[what]);
  }

  /** Clears what's unused: what it says it freed. */
  async prune(t: Target, what: Prune): Promise<string> {
    const r = await this.#runner.run(this.tool, this.pruneArgs(t, what), 300_000);
    if (r.code !== 0) throw new Error(engineError(this.kind, said(r)));
    return r.stdout.trim().split('\n').filter((l) => /reclaimed/i.test(l)).at(-1) ?? 'Done.';
  }

  /** Starts a container from an image: its id. */
  async run(t: Target, spec: RunSpec): Promise<string> {
    return (await this.#ok(t, runArgs(spec), 300_000)).trim().split('\n').at(-1)?.slice(0, 12) ?? '';
  }

  pull(t: Target, image: string): { cmd: string; args: string[] } {
    if (!IMAGE.test(image)) throw new Error(`“${image}” isn’t an image’s name.`);
    return { cmd: this.tool, args: this.args(t, ['pull', image]) };
  }

  /** Its logs, followed: the last 500 lines, then what's new. */
  logs(t: Target, id: string, timestamps = false): { cmd: string; args: string[] } {
    return { cmd: this.tool, args: this.args(t, ['logs', '-f', '--tail', '500', ...(timestamps ? ['--timestamps'] : []), id]) };
  }

  /** Its resource use, as it goes. */
  stats(t: Target, id: string): { cmd: string; args: string[] } {
    return { cmd: this.tool, args: this.args(t, ['stats', ...this.#json(), id]) };
  }

  /** A folder in a running container. */
  async list(t: Target, id: string, dir: string): Promise<FileEntry[]> {
    return entriesOf(await this.#ok(t, ['exec', id, 'sh', '-c', LIST_SCRIPT, 'sh', checkedPath(dir)], 30_000));
  }

  /** `cp CONTAINER:PATH -`: works on stopped containers too. */
  copyArgs(t: Target, id: string, file: string, to = '-'): string[] {
    return this.args(t, ['cp', `${id}:${checkedPath(file)}`, to]);
  }

  async read(t: Target, id: string, file: string): Promise<FileContent> {
    const child = this.#runner.spawn(this.tool, this.copyArgs(t, id, file), { stdio: ['ignore', 'pipe', 'pipe'], env: this.#runner.env });
    let err = '';
    child.stderr?.on('data', (d: Buffer) => (err += d.toString('utf8')));
    const exited = new Promise<number | null>((resolve) => child.on('close', resolve));
    const parts: Uint8Array[] = [];
    let head: { size: number; type: string } | null = null;
    try {
      for await (const part of firstEntry(child.stdout!, MAX_TEXT + 1)) {
        if (part instanceof Uint8Array) parts.push(part);
        else head = part;
      }
    } finally {
      child.kill();
    }
    if (!head) {
      const code = await exited;
      throw new Error(engineError(this.kind, err.trim() || `It can’t be read (exit code ${code}).`));
    }
    if (head.type === '5') throw new Error(`${file} is a folder.`);
    if (head.type === '2') throw new Error(`${file} is a link: open where it points.`);
    return contentOf(file, head.size, Buffer.concat(parts));
  }

  async copyOut(t: Target, id: string, file: string, to: string): Promise<void> {
    // #ok names the context itself.
    await this.#ok(t, ['cp', `${id}:${checkedPath(file)}`, to], 300_000);
  }

  /** What a terminal types for a shell in it: bash if it has one, else sh. */
  shell(t: Target, id: string): string {
    const ctx = this.kind === 'docker' && t.context ? ` --context ${t.context}` : '';
    return `${path.basename(this.tool).replace(/\.exe$/, '')}${ctx} exec -it ${id} sh -c "if command -v bash >/dev/null; then exec bash; else exec sh; fi"`;
  }
}
