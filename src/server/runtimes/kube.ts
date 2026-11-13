// Kubernetes, through kubectl: each of its contexts is a target, named on
// every command (`--context`), so the current one is never changed. Pods
// and deployments, in a namespace or all of them.

import type { Action, Deployment, FileContent, FileEntry, KubePod, Service, Snapshot, Target, Thing } from '../../shared/index.ts';
import { LIST_SCRIPT, MAX_TEXT, checkedPath, contentOf, entriesOf } from './files.ts';
import { type Runner, said } from '../tools.ts';

export function kubeError(text: string): string {
  if (/unable to connect to the server|connection refused|no such host|i\/o timeout|context deadline exceeded/i.test(text)) return `The cluster doesn’t answer (${text.replace(/^.*?:\s*/, '').slice(0, 160)}).`;
  if (/forbidden/i.test(text)) return `Not allowed: ${text}`;
  if (/you must be logged in|unauthorized/i.test(text)) return 'kubectl isn’t signed in to this cluster.';
  return text;
}

const time = (v: unknown) => {
  const t = Date.parse(String(v ?? ''));
  return Number.isFinite(t) ? t : null;
};

type Obj = Record<string, any>;

export function podOf(p: Obj): KubePod {
  const statuses: Obj[] = p.status?.containerStatuses ?? [];
  const containers: string[] = (p.spec?.containers ?? []).map((c: Obj) => String(c.name));
  const waiting = statuses.map((s) => s.state?.waiting?.reason ?? s.state?.terminated?.reason).find((r) => r && r !== 'Completed');
  return {
    name: String(p.metadata?.name ?? ''),
    namespace: String(p.metadata?.namespace ?? ''),
    phase: p.metadata?.deletionTimestamp ? 'Terminating' : (waiting ?? String(p.status?.phase ?? 'Unknown')),
    ready: `${statuses.filter((s) => s.ready).length}/${containers.length}`,
    restarts: statuses.reduce((n, s) => n + Number(s.restartCount ?? 0), 0),
    node: p.spec?.nodeName ?? null,
    created: time(p.metadata?.creationTimestamp),
    containers,
  };
}

export function deploymentOf(d: Obj): Deployment {
  const replicas = Number(d.spec?.replicas ?? 0);
  return {
    name: String(d.metadata?.name ?? ''),
    namespace: String(d.metadata?.namespace ?? ''),
    ready: `${Number(d.status?.readyReplicas ?? 0)}/${replicas}`,
    replicas,
    created: time(d.metadata?.creationTimestamp),
  };
}

export function serviceOf(s: Obj): Service {
  return {
    name: String(s.metadata?.name ?? ''),
    namespace: String(s.metadata?.namespace ?? ''),
    type: String(s.spec?.type ?? ''),
    clusterIP: String(s.spec?.clusterIP ?? ''),
    ports: ((s.spec?.ports ?? []) as Obj[]).map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol ?? 'TCP'}`),
    created: time(s.metadata?.creationTimestamp),
  };
}

export const NAMESPACE = /^([a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?|\*)$/;

export class Kube {
  readonly tool: string;
  readonly #runner: Runner;
  constructor(tool: string, runner: Runner) {
    this.tool = tool;
    this.#runner = runner;
  }

  #args(t: Target, args: string[]): string[] {
    return t.context ? ['--context', t.context, ...args] : args;
  }

  async targets(): Promise<Target[]> {
    const [list, view] = await Promise.all([
      this.#runner.run(this.tool, ['config', 'get-contexts', '-o', 'name'], 8000),
      this.#runner.run(this.tool, ['config', 'view', '-o', 'json'], 8000),
    ]);
    if (list.code !== 0) return [this.#none(`kubectl can’t read its config: ${said(list)}`)];
    let config: Obj = {};
    try {
      config = JSON.parse(view.stdout);
    } catch {}
    const current = config['current-context'];
    const names = list.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .sort((a, b) => Number(b === current) - Number(a === current));
    if (!names.length)
      return [
        this.#none(
          'kubectl has no clusters (no contexts in ~/.kube/config). Turn on Kubernetes in Docker Desktop (Settings → Kubernetes), start minikube, kind or k3d, or add a cluster to the kubeconfig; then look again (↻).',
        ),
      ];
    return Promise.all(
      names.map(async (name): Promise<Target> => {
        const ns = (config.contexts as Obj[] | undefined)?.find((c) => c.name === name)?.context?.namespace ?? 'default';
        const t: Target = { id: `kubernetes:${name}`, kind: 'kubernetes', name: `Kubernetes · ${name}`, context: name, ok: false, error: null, detail: null, namespace: ns };
        const r = await this.#runner.run(this.tool, this.#args(t, ['version', '-o', 'json', '--request-timeout=5s']), 10_000);
        try {
          const v = JSON.parse(r.stdout) as Obj;
          if (v.serverVersion?.gitVersion) return { ...t, ok: true, detail: `Kubernetes ${v.serverVersion.gitVersion}` };
        } catch {}
        return { ...t, error: kubeError(said(r)) };
      }),
    );
  }

  /** kubectl is here, without a cluster to show: said, not hidden. */
  #none(error: string): Target {
    return { id: 'kubernetes', kind: 'kubernetes', name: 'Kubernetes', context: null, ok: false, error, detail: null, namespace: 'default' };
  }

  #where(namespace: string): string[] {
    return namespace === '*' ? ['--all-namespaces'] : ['-n', namespace];
  }

  async snapshot(t: Target, namespace: string): Promise<Snapshot> {
    if (!t.context) return { target: t.id, error: t.error ?? 'No cluster.' };
    const [pods, deployments, namespaces, services] = await Promise.all([
      this.#runner.run(this.tool, this.#args(t, ['get', 'pods', ...this.#where(namespace), '-o', 'json', '--request-timeout=15s'])),
      this.#runner.run(this.tool, this.#args(t, ['get', 'deployments', ...this.#where(namespace), '-o', 'json', '--request-timeout=15s'])),
      this.#runner.run(this.tool, this.#args(t, ['get', 'namespaces', '-o', 'jsonpath={.items[*].metadata.name}', '--request-timeout=15s'])),
      this.#runner.run(this.tool, this.#args(t, ['get', 'services', ...this.#where(namespace), '-o', 'json', '--request-timeout=15s'])),
    ]);
    if (pods.code !== 0) return { target: t.id, error: kubeError(said(pods)) };
    const items = (r: { code: number | null; stdout: string }) => {
      if (r.code !== 0) return [];
      try {
        return (JSON.parse(r.stdout).items ?? []) as Obj[];
      } catch {
        return [];
      }
    };
    return {
      target: t.id,
      error: null,
      kubePods: items(pods).map(podOf),
      deployments: items(deployments).map(deploymentOf),
      services: items(services).map(serviceOf),
      // Listing namespaces may not be allowed: then only the one asked.
      namespaces: namespaces.code === 0 ? namespaces.stdout.trim().split(/\s+/).filter(Boolean).sort() : [],
    };
  }

  actionArgs(t: Target, action: Action, name: string, namespace: string, replicas?: number): string[] {
    switch (action) {
      case 'deletePod':
        return this.#args(t, ['delete', 'pod', name, '-n', namespace, '--wait=false']);
      case 'rolloutRestart':
        return this.#args(t, ['rollout', 'restart', `deployment/${name}`, '-n', namespace]);
      case 'scale':
        if (!Number.isInteger(replicas) || replicas! < 0 || replicas! > 1000) throw new Error('Replicas are a whole number from 0 to 1000.');
        return this.#args(t, ['scale', `deployment/${name}`, `--replicas=${replicas}`, '-n', namespace]);
      default:
        throw new Error(`Kubernetes can't ${action} here.`);
    }
  }

  async action(t: Target, action: Action, name: string, namespace: string, replicas?: number): Promise<void> {
    const r = await this.#runner.run(this.tool, this.actionArgs(t, action, name, namespace, replicas), 60_000);
    if (r.code !== 0) throw new Error(kubeError(said(r)));
  }

  async #ok(t: Target, args: string[], timeout = 30_000): Promise<string> {
    const r = await this.#runner.run(this.tool, this.#args(t, args), timeout);
    if (r.code !== 0) throw new Error(kubeError(said(r)));
    return r.stdout;
  }

  async inspect(t: Target, thing: Thing, name: string, namespace: string): Promise<unknown> {
    const kinds: Partial<Record<Thing, string>> = { kubePod: 'pod', deployment: 'deployment', service: 'service' };
    const kind = kinds[thing];
    if (!kind) throw new Error(`Kubernetes has no ${thing} here.`);
    return JSON.parse(await this.#ok(t, ['get', kind, name, '-n', namespace, '-o', 'json']));
  }

  /** `kubectl describe`: what it is, and its events. */
  describe(t: Target, thing: Thing, name: string, namespace: string): Promise<string> {
    const kinds: Partial<Record<Thing, string>> = { kubePod: 'pod', deployment: 'deployment', service: 'service' };
    if (!kinds[thing]) throw new Error(`Kubernetes can't describe a ${thing}.`);
    return this.#ok(t, ['describe', kinds[thing]!, name, '-n', namespace]);
  }

  #exec(pod: string, namespace: string, container: string | undefined, command: string[]): string[] {
    return ['exec', pod, '-n', namespace, ...(container ? ['-c', container] : []), '--', ...command];
  }

  async list(t: Target, pod: string, namespace: string, container: string | undefined, dir: string): Promise<FileEntry[]> {
    return entriesOf(await this.#ok(t, this.#exec(pod, namespace, container, ['sh', '-c', LIST_SCRIPT, 'sh', checkedPath(dir)])));
  }

  async read(t: Target, pod: string, namespace: string, container: string | undefined, file: string): Promise<FileContent> {
    const p = checkedPath(file);
    const out = await this.#ok(t, this.#exec(pod, namespace, container, ['sh', '-c', 'wc -c < "$1"; head -c $2 -- "$1"', 'sh', p, String(MAX_TEXT + 1)]));
    const nl = out.indexOf('\n');
    const size = Number(out.slice(0, nl).trim()) || 0;
    return contentOf(p, size, Buffer.from(out.slice(nl + 1), 'utf8'));
  }

  logs(t: Target, pod: string, namespace: string, container?: string): { cmd: string; args: string[] } {
    const which = container ? ['-c', container] : ['--all-containers=true', '--prefix=true', '--max-log-requests=10'];
    return { cmd: this.tool, args: this.#args(t, ['logs', '-f', '--tail=500', pod, '-n', namespace, ...which]) };
  }

  shell(t: Target, pod: string, namespace: string, container?: string): string {
    const ctx = t.context ? ` --context "${t.context}"` : '';
    const c = container ? ` -c ${container}` : '';
    return `kubectl${ctx} exec -it -n ${namespace} ${pod}${c} -- sh -c "if command -v bash >/dev/null; then exec bash; else exec sh; fi"`;
  }
}
