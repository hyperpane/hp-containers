// The server part with stand-ins for docker, podman and kubectl
// (fake-tools.mjs, behind small scripts named as the tools): what's found,
// what each one runs, the actions' command lines, logs, and what's refused.

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { invoke, stream, testHost } from '@hyperpane/sdk/testing';
import { make } from '../../src/server/plugin.ts';
import { Engine } from '../../src/server/runtimes/engine/engine.ts';
import { portsOf, stateOf } from '../../src/server/runtimes/engine/parse.ts';
import { Kube } from '../../src/server/runtimes/kube.ts';
import { Runner } from '../../src/server/tools.ts';
import type { Snapshot, Target } from '../../src/shared/index.ts';

const FAKE = path.join(import.meta.dirname, 'fake-tools.mjs');
const WIN = process.platform === 'win32';

/** A folder of scripts named docker, podman and kubectl that run the fake. */
function tools(only = ['docker', 'podman', 'kubectl']) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ctools-'));
  const log = path.join(dir, 'runs.log');
  for (const t of only) {
    const file = path.join(dir, t);
    writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "${log}" ${t} "$@"\n`);
    chmodSync(file, 0o755);
  }
  const host = testHost({ id: 'containers' });
  const plugin = make({ which: (n) => (only.includes(n) ? path.join(dir, n) : null), pollEvery: 50 })(host);
  const runs = (): string[][] => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { plugin, runs, call: <T>(req: Record<string, unknown>) => invoke<T>(plugin, req) };
}

test('finds each Docker context, Podman, and each kubectl context, and says which answer', { skip: WIN }, async () => {
  const t = tools();
  const all = await t.call<Target[]>({ op: 'targets' });
  const list = all.filter((x) => x.installed !== false);
  assert.deepEqual(
    all.filter((x) => x.installed === false).map((x) => x.id),
    ['missing:nerdctl', 'missing:pm2', 'missing:tmux', 'missing:screen'],
    'the ones not here, listed last',
  );
  assert.match(all.find((x) => x.id === 'missing:pm2')!.error!, /npm install -g pm2/);
  const by = Object.fromEntries(list.map((x) => [x.id, x]));
  assert.deepEqual(
    list.map((x) => x.id),
    ['docker:desktop-linux', 'docker:default', 'podman', 'kubernetes:kind-dev', 'kubernetes:prod'],
    'the current contexts first',
  );
  assert.equal(by['docker:desktop-linux'].ok, true);
  assert.equal(by['docker:desktop-linux'].detail, 'Docker 28.0.1');
  assert.equal(by['docker:default'].ok, false);
  assert.match(by['docker:default'].error!, /Docker isn’t running here: start Docker Desktop/);
  assert.equal(by.podman.detail, 'Podman 5.2.0');
  assert.equal(by['kubernetes:kind-dev'].namespace, 'web');
  assert.equal(by['kubernetes:kind-dev'].detail, 'Kubernetes v1.31.0');
  assert.match(by['kubernetes:prod'].error!, /The cluster doesn’t answer/);
  assert.equal(by['kubernetes:prod'].namespace, 'default');
});

test('kubectl without clusters: Kubernetes is there, saying why it’s empty', { skip: WIN }, async () => {
  process.env.FAKE_NO_CONTEXTS = '1';
  const t = tools(['kubectl']);
  try {
    const [k] = (await t.call<Target[]>({ op: 'targets' })).filter((x) => x.installed !== false);
    assert.equal(k.id, 'kubernetes');
    assert.equal(k.ok, false);
    assert.match(k.error!, /kubectl has no clusters .*Docker Desktop/);
    const s = await t.call<Snapshot>({ op: 'snapshot', target: 'kubernetes' });
    assert.match(s.error!, /no clusters/);
  } finally {
    delete process.env.FAKE_NO_CONTEXTS;
  }
});

test('nothing installed: no targets', async () => {
  const t = tools([]);
  assert.ok((await t.call<Target[]>({ op: 'targets' })).every((x) => x.installed === false));
});

test('Docker: containers by Compose project, their ports once, images', { skip: WIN }, async () => {
  const t = tools(['docker']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: 'docker:desktop-linux' });
  assert.equal(s.error, null);
  const [db, web, lonely] = s.containers!;
  assert.deepEqual(db, { id: 'aaa111bbb222', name: 'shop-db-1', image: 'postgres:16', state: 'running', status: 'Up 2 hours', ports: ['5432->5432/tcp'], group: 'shop' });
  assert.equal(web.state, 'exited');
  assert.equal(lonely.state, 'paused', 'from its status, when there’s no State');
  assert.equal(lonely.group, null);
  assert.deepEqual(
    s.images!.map((i) => [i.id, i.name, i.containers]),
    [
      ['1234567890ab', 'postgres:16', null],
      ['9876543210ab', '<none>', null],
    ],
  );
  assert.ok(
    t.runs().filter((r) => r.includes('ps') || r.includes('images')).every((r) => r[1] === '--context' && r[2] === 'desktop-linux'),
    'every command names the context',
  );
  const down = await t.call<Snapshot>({ op: 'snapshot', target: 'docker:default' });
  assert.match(down.error!, /Docker isn’t running here/);
});

test('Podman: its own JSON, pods, and Compose projects', { skip: WIN }, async () => {
  const t = tools(['podman']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: 'podman' });
  assert.deepEqual(s.containers![0], { id: '0123456789ab', name: 'api', image: 'quay.io/app/api:1', state: 'running', status: 'Up 4 minutes', ports: ['18080->8080/tcp'], group: 'backend' });
  assert.equal(s.containers![1].group, 'tools');
  assert.equal(s.containers![1].status, 'exited');
  assert.deepEqual(s.images![0], { id: 'abcdefabcdef', name: 'quay.io/app/api:1', size: '123 MB', created: new Date(1794000000 * 1000).toISOString().slice(0, 10), containers: 1 });
  assert.deepEqual(s.pods, [{ id: '999999999999', name: 'backend', status: 'Running', containers: 2 }]);
});

test('Kubernetes: pods (why one waits), deployments and namespaces, with its context named', { skip: WIN }, async () => {
  const t = tools(['kubectl']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: 'kubernetes:kind-dev' });
  const [web, job] = s.kubePods!;
  assert.equal(web.phase, 'CrashLoopBackOff');
  assert.equal(web.ready, '1/2');
  assert.equal(web.restarts, 7);
  assert.deepEqual(web.containers, ['web', 'sidecar']);
  assert.equal(job.phase, 'Succeeded', 'a container that completed isn’t a problem');
  assert.deepEqual(s.deployments, [{ name: 'web', namespace: 'web', ready: '2/3', replicas: 3, created: null }]);
  assert.deepEqual(s.namespaces, ['default', 'kube-system', 'web']);
  const pods = t.runs().find((r) => r.includes('pods'))!;
  assert.deepEqual(pods.slice(1, 7), ['--context', 'kind-dev', 'get', 'pods', '-n', 'web'], 'its own namespace by default');
  await t.call({ op: 'snapshot', target: 'kubernetes:kind-dev', namespace: '*' });
  assert.ok(t.runs().some((r) => r.includes('--all-namespaces')));
});

test('actions: the command lines, and what’s refused', { skip: WIN }, async () => {
  const t = tools();
  await t.call({ op: 'action', target: 'docker:desktop-linux', action: 'remove', id: 'aaa111bbb222' });
  await t.call({ op: 'action', target: 'podman', action: 'podStop', id: 'backend' });
  await t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'scale', id: 'web', namespace: 'web', replicas: 5 });
  await t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'rolloutRestart', id: 'web', namespace: 'web' });
  const runs = t.runs().map((r) => r.join(' '));
  assert.ok(runs.includes('docker --context desktop-linux rm -f aaa111bbb222'));
  assert.ok(runs.includes('podman pod stop backend'));
  assert.ok(runs.includes('kubectl --context kind-dev scale deployment/web --replicas=5 -n web'));
  assert.ok(runs.includes('kubectl --context kind-dev rollout restart deployment/web -n web'));

  await assert.rejects(t.call({ op: 'action', target: 'docker:desktop-linux', action: 'removeImage', id: 'postgres:16' }), /unable to remove repository reference/);
  await assert.rejects(t.call({ op: 'action', target: 'docker:desktop-linux', action: 'stop', id: '-rf' }), /isn’t a name/);
  await assert.rejects(t.call({ op: 'action', target: 'docker:desktop-linux', action: 'scale', id: 'x' }), /can’t scale/);
  await assert.rejects(t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'stop', id: 'web' }), /Kubernetes can’t stop/);
  await assert.rejects(t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'scale', id: 'web', namespace: 'web', replicas: -1 }), /whole number from 0 to 1000/);
  await assert.rejects(t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'deletePod', id: 'web', namespace: '*' }), /which namespace/);
  await assert.rejects(t.call({ op: 'action', target: 'kubernetes:kind-dev', action: 'deletePod', id: 'web', namespace: 'Bad_NS' }), /isn’t a namespace/);
  await assert.rejects(t.call({ op: 'action', target: 'lxc', action: 'start', id: 'x' }), /isn’t on this server/);
});

test('logs follow, both streams, until the window stops watching', { skip: WIN }, async () => {
  const t = tools(['docker', 'kubectl']);
  const s = stream<{ text: string }>(t.plugin, { op: 'logs', target: 'docker:desktop-linux', id: 'aaa111bbb222' });
  let got = '';
  while (!got.includes('db ready') || !got.includes('a warning')) got += (await s.next()).text;
  s.cancel();
  assert.equal(await s.end, null);
  assert.ok(t.runs().some((r) => r.join(' ') === 'docker --context desktop-linux logs -f --tail 500 aaa111bbb222'));
  const k = stream<{ text: string }>(t.plugin, { op: 'logs', target: 'kubernetes:kind-dev', id: 'web-7d4-abc', namespace: 'web' });
  assert.match((await k.next()).text, /hello/);
  k.cancel();
  assert.ok(t.runs().some((r) => r.join(' ') === 'kubectl --context kind-dev logs -f --tail=500 web-7d4-abc -n web --all-containers=true --prefix=true --max-log-requests=10'));
});

test('a shell: what the terminal types', () => {
  const runner = new Runner(() => {
    throw new Error('not run');
  });
  const docker = new Engine('docker', '/usr/local/bin/docker', runner);
  const t: Target = { id: 'docker:orbstack', kind: 'docker', name: 'Docker · orbstack', context: 'orbstack', ok: true, error: null, detail: null, namespace: null };
  assert.equal(docker.shell(t, 'abc123'), 'docker --context orbstack exec -it abc123 sh -c "if command -v bash >/dev/null; then exec bash; else exec sh; fi"');
  const kube = new Kube('kubectl', runner);
  const k: Target = { ...t, id: 'kubernetes:arn:aws:eks:x/y', kind: 'kubernetes', context: 'arn:aws:eks:x/y' };
  assert.equal(kube.shell(k, 'web-1', 'web', 'sidecar'), 'kubectl --context "arn:aws:eks:x/y" exec -it -n web web-1 -c sidecar -- sh -c "if command -v bash >/dev/null; then exec bash; else exec sh; fi"');
});

test('states and ports as the managers say them', () => {
  assert.equal(stateOf(undefined, 'Up 5 minutes'), 'running');
  assert.equal(stateOf('', 'Exited (137) 2 hours ago'), 'exited');
  assert.equal(stateOf('stopped', ''), 'exited');
  assert.equal(stateOf('weird', 'who knows'), 'unknown');
  assert.deepEqual(portsOf('0.0.0.0:80->80/tcp, :::80->80/tcp, 127.0.0.1:9000->9000/tcp, 5000/tcp'), ['80->80/tcp', '127.0.0.1:9000->9000/tcp', '5000/tcp']);
});
