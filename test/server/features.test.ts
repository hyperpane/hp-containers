// Everything past the lists: volumes and networks, inspect, layers, disk
// usage and cleaning up, running an image, files inside a container (and
// out of it), live stats, Compose projects; pm2, tmux and screen; and
// Kubernetes' services, describe and files.

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { invoke, stream, testHost } from '@hyperpane/sdk/testing';
import { make } from '../../src/server/plugin.ts';
import { runArgs } from '../../src/server/runtimes/engine/args.ts';
import { entriesOf } from '../../src/server/runtimes/files.ts';
import { screensOf } from '../../src/server/runtimes/processes.ts';
import type { DiskUsage, FileContent, FileEntry, Layer, Snapshot, Stats, Target } from '../../src/shared/index.ts';

const FAKE = path.join(import.meta.dirname, 'fake-tools.mjs');
const skip = process.platform === 'win32';

function tools(only: string[]) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ctools-'));
  const project = mkdtempSync(path.join(os.tmpdir(), 'cproject-'));
  const log = path.join(dir, 'runs.log');
  for (const t of only) {
    writeFileSync(path.join(dir, t), `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "${log}" ${t} "$@"\n`);
    chmodSync(path.join(dir, t), 0o755);
  }
  const host = testHost({ id: 'containers', projects: [{ id: 'p1', name: 'app', folder: project }] });
  const plugin = make({ which: (n) => (only.includes(n) ? path.join(dir, n) : null), pollEvery: 50 })(host);
  const runs = (): string[] =>
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => (JSON.parse(l) as string[]).join(' '))
      : [];
  return { plugin, project, runs, call: <T>(req: Record<string, unknown>) => invoke<T>(plugin, req) };
}

const D = 'docker:desktop-linux';

test('Docker: volumes (and what uses them), networks (the built-in ones marked)', { skip }, async () => {
  const t = tools(['docker']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: D });
  assert.deepEqual(s.volumes, [
    { name: 'pgdata', driver: 'local', mountpoint: '/var/lib/docker/volumes/pgdata/_data', usedBy: ['shop-db-1'] },
    { name: 'orphan', driver: 'local', mountpoint: '/var/lib/docker/volumes/orphan/_data', usedBy: [] },
  ]);
  assert.deepEqual(
    s.networks!.map((n) => [n.name, n.builtIn]),
    [
      ['bridge', true],
      ['shop_default', false],
    ],
  );
  assert.equal((s.containers![0] as unknown as Record<string, unknown>).mounts, undefined, 'mounts stay on the server');
});

test('Docker: inspect, layers, disk usage, cleaning up', { skip }, async () => {
  const t = tools(['docker']);
  assert.deepEqual(await t.call({ op: 'inspect', target: D, thing: 'container', id: 'aaa111bbb222' }), { Id: 'aaa111bbb222ccc', Config: { Env: ['A=1'] } });
  const layers = await t.call<Layer[]>({ op: 'history', target: D, id: 'postgres:16' });
  assert.deepEqual(layers[0], { id: 'aaaaaaaaaaaa', created: '2 weeks ago', createdBy: 'CMD ["postgres"]', size: '0B', comment: '' });
  assert.equal(layers[1].createdBy, 'RUN apt-get update');
  const df = await t.call<DiskUsage[]>({ op: 'diskUsage', target: D });
  assert.deepEqual(df[0], { type: 'Images', total: 5, active: 2, size: '1.2GB', reclaimable: '800MB (66%)' });
  assert.equal(await t.call({ op: 'prune', target: D, what: 'allImages' }), 'Total reclaimed space: 812MB');
  await t.call({ op: 'prune', target: D, what: 'buildCache' });
  assert.ok(t.runs().includes('docker --context desktop-linux image prune -a -f'));
  assert.ok(t.runs().includes('docker --context desktop-linux builder prune -f'));
  await assert.rejects(t.call({ op: 'prune', target: D, what: 'everything' }), /no “everything” to clean up/);
});

test('Docker: Compose projects, volumes and networks are acted on by name', { skip }, async () => {
  const t = tools(['docker']);
  for (const [action, id] of [
    ['composeDown', 'shop'],
    ['removeVolume', 'orphan'],
    ['removeNetwork', 'shop_default'],
    ['kill', 'aaa111bbb222'],
  ])
    await t.call({ op: 'action', target: D, action, id });
  for (const line of [
    'docker --context desktop-linux compose -p shop down',
    'docker --context desktop-linux volume rm orphan',
    'docker --context desktop-linux network rm shop_default',
    'docker --context desktop-linux kill aaa111bbb222',
  ])
    assert.ok(t.runs().includes(line), line);
});

test('running an image: its arguments, each part checked', { skip }, async () => {
  assert.deepEqual(
    runArgs({
      image: 'nginx:1.27',
      name: 'web',
      ports: ['8080:80', '127.0.0.1:53:53/udp'],
      env: ['A=1', 'B=two words'],
      volumes: ['data:/usr/share/nginx/html:ro'],
      restart: 'unless-stopped',
      command: ['nginx', '-g', 'daemon off;'],
    }),
    [
      'run',
      '-d',
      '--name',
      'web',
      '-p',
      '8080:80',
      '-p',
      '127.0.0.1:53:53/udp',
      '-e',
      'A=1',
      '-e',
      'B=two words',
      '-v',
      'data:/usr/share/nginx/html:ro',
      '--restart',
      'unless-stopped',
      'nginx:1.27',
      'nginx',
      '-g',
      'daemon off;',
    ],
  );
  assert.throws(() => runArgs({ image: '--privileged' }), /which image/);
  assert.throws(() => runArgs({ image: 'nginx', ports: ['80:80 --privileged'] }), /isn’t a port mapping/);
  assert.throws(() => runArgs({ image: 'nginx', env: ['1A=x'] }), /isn’t KEY=value/);
  assert.throws(() => runArgs({ image: 'nginx', volumes: ['--mount=x'] }), /isn’t a volume/);
  assert.throws(() => runArgs({ image: 'nginx', restart: 'sometimes' }), /Restart is/);
  const t = tools(['docker']);
  assert.equal(await t.call({ op: 'run', target: D, spec: { image: 'nginx', ports: ['8080:80'] } }), '0123456789ab');
});

test('files inside a container: a folder, a file’s text, not text, a folder refused, a copy into the project', { skip }, async () => {
  const t = tools(['docker']);
  const list = await t.call<FileEntry[]>({ op: 'files', target: D, id: 'aaa111bbb222', path: '/' });
  assert.deepEqual(
    list.map((f) => [f.name, f.type, f.link]),
    [
      ['etc', 'dir', null],
      ['.env', 'file', null],
      ['lib', 'link', 'usr/lib'],
    ],
  );
  assert.match(t.runs().find((r) => r.includes(' exec '))!, /exec aaa111bbb222 sh -c .* sh \/$/s);
  await assert.rejects(t.call({ op: 'files', target: D, id: 'aaa111bbb222', path: '/nope' }), /can't cd to \/nope/);
  await assert.rejects(t.call({ op: 'files', target: D, id: 'aaa111bbb222', path: 'relative' }), /starts with \//);

  const text = await t.call<FileContent>({ op: 'readFile', target: D, id: 'aaa111bbb222', path: '/srv/hello.txt' });
  assert.deepEqual(text, { path: '/srv/hello.txt', size: 25, text: 'hello from the container\n', truncated: false });
  const bin = await t.call<FileContent>({ op: 'readFile', target: D, id: 'aaa111bbb222', path: '/bin/app' });
  assert.equal(bin.text, null);
  await assert.rejects(t.call({ op: 'readFile', target: D, id: 'aaa111bbb222', path: '/etc' }), /is a folder/);

  const where = await t.call<string>({ op: 'copyToProject', project: 'p1', target: D, id: 'aaa111bbb222', path: '/srv/hello.txt' });
  assert.equal(where, 'hello.txt');
  assert.ok(t.runs().some((r) => r === `docker --context desktop-linux cp aaa111bbb222:/srv/hello.txt ${path.join(t.project, 'hello.txt')}`));
});

test('a file saved to this machine comes without its tar', { skip }, async () => {
  const t = tools(['docker']);
  const reply = await t.call<{ data: ReadableStream<Uint8Array> }>({ op: 'download', target: D, id: 'aaa111bbb222', path: '/srv/hello.txt' });
  const chunks: Uint8Array[] = [];
  for await (const c of reply.data) chunks.push(c);
  assert.equal(Buffer.concat(chunks).toString(), 'hello from the container\n');
});

test('stats as they come, out of a redrawn screen', { skip }, async () => {
  const t = tools(['docker']);
  const s = stream<{ stats: Stats }>(t.plugin, { op: 'stats', target: D, id: 'aaa111bbb222' });
  const first = (await s.next()).stats;
  assert.equal(first.cpu, 12.5);
  assert.equal(first.mem, 3.1);
  assert.equal(first.memUsage, '64MiB / 2GiB');
  const second = (await s.next()).stats;
  assert.equal(second.cpu, 50);
  assert.equal(second.pids, '8');
  s.cancel();
});

test('pm2: its processes (past its banner), actions and logs', { skip }, async () => {
  const t = tools(['pm2']);
  const [target] = (await t.call<Target[]>({ op: 'targets' })).filter((x) => x.installed !== false);
  assert.deepEqual([target.id, target.ok, target.detail], ['pm2', true, 'pm2 5.4.2']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: 'pm2' });
  assert.deepEqual(s.processes![0], {
    id: '0',
    name: 'api',
    status: 'online',
    pid: 4242,
    cpu: 3,
    memory: 52428800,
    restarts: 2,
    since: 1794500000000,
    cwd: '/srv/api',
    mode: 'cluster × 4',
  });
  assert.equal(s.processes![1].status, 'errored');
  assert.equal(s.processes![1].since, null);
  await t.call({ op: 'action', target: 'pm2', action: 'pm2Reload', id: '0' });
  assert.ok(t.runs().includes('pm2 reload 0'));
  await assert.rejects(t.call({ op: 'action', target: 'pm2', action: 'pm2Stop', id: 'all' }), /isn’t a pm2 process/);
  assert.equal(((await t.call({ op: 'inspect', target: 'pm2', thing: 'process', id: '1' })) as { name: string }).name, 'worker');
  const logs = stream<{ text: string }>(t.plugin, { op: 'logs', target: 'pm2', id: '0' });
  assert.match((await logs.next()).text, /listening/);
  logs.cancel();
  assert.ok(t.runs().includes('pm2 logs 0 --raw --lines 500'));
});

test('tmux and screen: sessions, their screens, attaching and ending', { skip }, async () => {
  const t = tools(['tmux', 'screen']);
  const ids = (await t.call<Target[]>({ op: 'targets' })).filter((x) => x.installed !== false).map((x) => x.id);
  assert.deepEqual(ids, ['tmux', 'screen']);
  const tmux = await t.call<Snapshot>({ op: 'snapshot', target: 'tmux' });
  assert.deepEqual(tmux.sessions![0], { id: 'dev', name: 'dev', attached: true, windows: 3, created: 1794500000000 });
  assert.equal(await t.call({ op: 'screen', target: 'tmux', id: 'dev' }), '$ npm run dev\nready on :3000\n');
  await t.call({ op: 'action', target: 'tmux', action: 'sessionKill', id: 'build' });
  assert.ok(t.runs().includes('tmux kill-session -t =build'));
  const screen = await t.call<Snapshot>({ op: 'snapshot', target: 'screen' });
  assert.deepEqual(
    screen.sessions!.map((s) => [s.id, s.name, s.attached]),
    [
      ['4242.work', 'work', false],
      ['77.pts-1.box', 'pts-1.box', true],
    ],
  );
  await t.call({ op: 'action', target: 'screen', action: 'sessionKill', id: '4242.work' });
  assert.ok(t.runs().includes('screen -S 4242.work -X quit'));
  await assert.rejects(t.call({ op: 'action', target: 'screen', action: 'sessionKill', id: 'work; rm -rf /' }), /isn’t a screen session/);
});

test('Kubernetes: services, describe, and files in a pod', { skip }, async () => {
  const t = tools(['kubectl']);
  const s = await t.call<Snapshot>({ op: 'snapshot', target: 'kubernetes:kind-dev' });
  assert.deepEqual(s.services![0], { name: 'web', namespace: 'web', type: 'NodePort', clusterIP: '10.96.0.12', ports: ['80:30080/TCP'], created: null });
  assert.match(
    await t.call<string>({ op: 'describe', target: 'kubernetes:kind-dev', thing: 'kubePod', id: 'web-7d4-abc', namespace: 'web' }),
    /Back-off restarting/,
  );
  const files = await t.call<FileEntry[]>({
    op: 'files',
    target: 'kubernetes:kind-dev',
    id: 'web-7d4-abc',
    namespace: 'web',
    container: 'web',
    path: '/etc/app',
  });
  assert.equal(files[0].name, 'app.conf');
  assert.ok(t.runs().some((r) => r.startsWith('kubectl --context kind-dev exec web-7d4-abc -n web -c web -- sh -c')));
  const f = await t.call<FileContent>({ op: 'readFile', target: 'kubernetes:kind-dev', id: 'web-7d4-abc', namespace: 'web', path: '/etc/app/app.conf' });
  assert.equal(f.text, 'hello\n');
  assert.equal(f.size, 6);
});

test('the listing script’s lines, and screen -ls', () => {
  assert.deepEqual(entriesOf('regular empty file\t0\t0\tempty\ncharacter special file\t0\t1\tnull\n'), [
    { name: 'empty', type: 'file', size: 0, mtime: null, link: null },
    { name: 'null', type: 'other', size: 0, mtime: 1000, link: null },
  ]);
  assert.deepEqual(screensOf('No Sockets found in /run/screen/S-me.\n'), []);
});
