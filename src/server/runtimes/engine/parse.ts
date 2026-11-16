// What Docker, Podman and nerdctl print, as the shared shapes. Docker's
// (and nerdctl's) `--format '{{json .}}'` gives one object a line; Podman's
// `--format json` gives an array, with its own names for things.

import type { Container, Image, Network, State, Stats } from '../../../shared/index.ts';
import type { EngineKind } from './kinds.ts';

export const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

export function stateOf(state: unknown, status: string): State {
  const s = str(state).toLowerCase();
  if (['running', 'exited', 'paused', 'created', 'restarting', 'dead', 'removing'].includes(s)) return s as State;
  if (s === 'stopped' || s === 'configured') return s === 'stopped' ? 'exited' : 'created';
  if (/\(paused\)/i.test(status)) return 'paused';
  if (/^up /i.test(status)) return 'running';
  if (/^exited/i.test(status)) return 'exited';
  if (/^created/i.test(status)) return 'created';
  if (/^restarting/i.test(status)) return 'restarting';
  return 'unknown';
}

/** `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp` as `8080->80/tcp`, once. */
export function portsOf(ports: string): string[] {
  const out = new Set<string>();
  for (const p of ports
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)) {
    out.add(p.replace(/^(0\.0\.0\.0|\[::\]|::|):(?=\d)/, '').replace(/^:::/, ''));
  }
  return [...out];
}

/** Docker's labels, `a=b,c=d`. */
function labelsOf(v: unknown): Record<string, string> {
  if (v && typeof v === 'object') return v as Record<string, string>;
  const out: Record<string, string> = {};
  for (const pair of str(v).split(',')) {
    const at = pair.indexOf('=');
    if (at > 0) out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
}

export function size(bytes: number): string {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let u = 0;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return `${n >= 100 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

export function containerOf(kind: EngineKind, raw: Record<string, unknown>): Container & { mounts: string[] } {
  if (kind === 'podman') {
    const names = raw.Names as unknown;
    const ports = Array.isArray(raw.Ports)
      ? (raw.Ports as Record<string, unknown>[]).map((p) => {
          const range = Number(p.range ?? 1);
          const host = Number(p.host_port);
          const inside = Number(p.container_port);
          const span = (n: number) => (range > 1 ? `${n}-${n + range - 1}` : `${n}`);
          return `${span(host)}->${span(inside)}/${str(p.protocol) || 'tcp'}`;
        })
      : [];
    const labels = labelsOf(raw.Labels);
    const status = str(raw.Status) || str(raw.State);
    return {
      id: str(raw.Id).slice(0, 12),
      name: Array.isArray(names) ? str(names[0]) : str(names),
      image: str(raw.Image),
      state: stateOf(raw.State, status),
      status,
      ports,
      group: str(raw.PodName) || labels['com.docker.compose.project'] || labels['io.podman.compose.project'] || null,
      mounts: [],
    };
  }
  const status = str(raw.Status);
  const labels = labelsOf(raw.Labels);
  return {
    id: str(raw.ID).slice(0, 12),
    name: str(raw.Names).split(',')[0],
    image: str(raw.Image),
    state: stateOf(raw.State, status),
    status,
    ports: portsOf(str(raw.Ports)),
    group: labels['com.docker.compose.project'] || null,
    mounts: str(raw.Mounts)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  };
}

export function imageOf(kind: EngineKind, raw: Record<string, unknown>): Image {
  if (kind === 'podman') {
    const names = Array.isArray(raw.Names) ? (raw.Names as string[]) : [];
    const created = Number(raw.Created);
    return {
      id: str(raw.Id)
        .replace(/^sha256:/, '')
        .slice(0, 12),
      name: names[0] ?? '<none>',
      size: size(Number(raw.Size)),
      created: Number.isFinite(created) ? new Date(created * 1000).toISOString().slice(0, 10) : '',
      containers: Number.isFinite(Number(raw.Containers)) ? Number(raw.Containers) : null,
    };
  }
  const repo = str(raw.Repository);
  const tag = str(raw.Tag);
  const containers = Number(raw.Containers);
  return {
    id: str(raw.ID)
      .replace(/^sha256:/, '')
      .slice(0, 12),
    name: repo === '<none>' || !repo ? '<none>' : tag && tag !== '<none>' ? `${repo}:${tag}` : repo,
    size: str(raw.Size),
    created: str(raw.CreatedSince) || str(raw.CreatedAt),
    containers: Number.isFinite(containers) ? containers : null,
  };
}

const BUILT_IN_NETWORKS = new Set(['bridge', 'host', 'none', 'podman']);

export function networkOf(raw: Record<string, unknown>): Network {
  const name = str(pick(raw, 'Name', 'name'));
  return {
    id: str(pick(raw, 'ID', 'Id', 'id')).slice(0, 12),
    name,
    driver: str(pick(raw, 'Driver', 'driver')),
    scope: str(pick(raw, 'Scope', 'scope')) || 'local',
    builtIn: BUILT_IN_NETWORKS.has(name),
  };
}

/** `"12.5%"` as 12.5. */
const percent = (v: unknown) => Number.parseFloat(str(v).replace('%', '')) || 0;

export function statsOf(raw: Record<string, unknown>): Stats {
  const mem = pick(raw, 'MemUsage', 'mem_usage');
  return {
    at: Date.now(),
    cpu: percent(pick(raw, 'CPUPerc', 'cpu_percent', 'CPU')),
    mem: percent(pick(raw, 'MemPerc', 'mem_percent', 'MemPerc')),
    memUsage: str(mem),
    netIO: str(pick(raw, 'NetIO', 'net_io')),
    blockIO: str(pick(raw, 'BlockIO', 'block_io')),
    pids: str(pick(raw, 'PIDs', 'pids', 'PIDS')),
  };
}

/** The flat JSON objects in what `stats` prints (it redraws the screen
 * between them). */
export function statsObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of text.matchAll(/\{[^{}]*\}/g)) {
    try {
      out.push(JSON.parse(m[0]));
    } catch {}
  }
  return out;
}
