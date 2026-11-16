// Stand-ins for docker, podman and kubectl, answering as they do:
// `node fake-tools.mjs LOG TOOL ...args`. Each run's arguments go to LOG.

import { appendFileSync } from 'node:fs';

const [log, tool, ...args] = process.argv.slice(2);
appendFileSync(log, `${JSON.stringify([tool, ...args])}\n`);
const a = args.join(' ');
const out = (s) => process.stdout.write(s);
const fail = (s, code = 1) => {
  process.stderr.write(`${s}\n`);
  process.exit(code);
};
const json = (v) => out(`${JSON.stringify(v)}\n`);

/** A tar of one file, as `docker cp … -` sends it. */
function tarOf(name, body, type = '0') {
  const h = Buffer.alloc(512);
  h.write(name, 0);
  h.write('0000644\0', 100);
  h.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
  h.write(
    `${Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0')}\0`,
    136,
  );
  h.write('        ', 148);
  h.write(type, 156);
  h.write('ustar\0', 257);
  h.write('00', 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  const pad = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([h, body, pad, Buffer.alloc(1024)]);
}

if (tool === 'docker') {
  if (a.startsWith('context ls')) {
    json({ Name: 'default', Current: false, DockerEndpoint: 'unix:///var/run/docker.sock' });
    json({ Name: 'desktop-linux', Current: true, DockerEndpoint: 'unix:///Users/x/.docker/run/docker.sock' });
  } else if (a.startsWith('--context default')) {
    fail('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');
  } else if (a.includes(' version ')) {
    out('"28.0.1"\n');
  } else if (a.includes(' ps -a')) {
    json({
      ID: 'aaa111bbb222ccc',
      Names: 'shop-db-1',
      Image: 'postgres:16',
      State: 'running',
      Status: 'Up 2 hours',
      Ports: '0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp',
      Labels: 'com.docker.compose.project=shop,com.docker.compose.service=db',
      Mounts: 'pgdata,/Users/x/shop/i…',
    });
    json({
      ID: 'ddd444eee555',
      Names: 'shop-web-1',
      Image: 'shop-web',
      State: 'exited',
      Status: 'Exited (1) 5 minutes ago',
      Ports: '',
      Labels: 'com.docker.compose.project=shop',
    });
    json({ ID: 'fff666', Names: 'lonely', Image: 'redis', Status: 'Up 3 days (Paused)', Ports: '', Labels: '' });
  } else if (a.includes(' images')) {
    json({ ID: 'sha256:1234567890abcdef', Repository: 'postgres', Tag: '16', Size: '432MB', CreatedSince: '2 weeks ago', Containers: 'N/A' });
    json({ ID: '9876543210ab', Repository: '<none>', Tag: '<none>', Size: '12MB', CreatedSince: '3 days ago', Containers: 'N/A' });
  } else if (a.includes(' volume ls')) {
    json({ Name: 'pgdata', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/pgdata/_data' });
    json({ Name: 'orphan', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/orphan/_data' });
  } else if (a.includes(' network ls')) {
    json({ ID: 'abcdef1234567890', Name: 'bridge', Driver: 'bridge', Scope: 'local' });
    json({ ID: '1234567890abcdef', Name: 'shop_default', Driver: 'bridge', Scope: 'local' });
  } else if (a.includes(' container inspect ')) {
    out(JSON.stringify([{ Id: 'aaa111bbb222ccc', Config: { Env: ['A=1'] } }]));
  } else if (a.includes(' history ')) {
    json({ ID: 'sha256:aaaaaaaaaaaaaaaa', CreatedSince: '2 weeks ago', CreatedBy: '/bin/sh -c #(nop)  CMD ["postgres"]', Size: '0B', Comment: '' });
    json({ ID: '<missing>', CreatedSince: '2 weeks ago', CreatedBy: 'RUN apt-get update', Size: '120MB', Comment: 'buildkit.dockerfile.v0' });
  } else if (a.includes(' system df')) {
    json({ Type: 'Images', TotalCount: '5', Active: '2', Size: '1.2GB', Reclaimable: '800MB (66%)' });
    json({ Type: 'Build Cache', TotalCount: '10', Active: '0', Size: '300MB', Reclaimable: '300MB' });
  } else if (a.includes(' prune ')) {
    out('Deleted Images:\nuntagged: x\n\nTotal reclaimed space: 812MB\n');
  } else if (a.includes(' run -d ')) {
    out('0123456789abcdef0123456789abcdef\n');
  } else if (a.includes(' exec ') && a.includes(' sh -c ')) {
    const dir = args.at(-1);
    if (dir === '/nope') fail("sh: cd: line 1: can't cd to /nope: No such file or directory", 3);
    out('directory\t4096\t1794500000\tetc\nregular file\t12\t1794500001\t.env\nsymbolic link\t7\t1794500002\tlib\n-> usr/lib\n');
  } else if (a.includes(' cp ') && args.at(-1) === '-') {
    const from = args.at(-2).split(':').slice(1).join(':');
    if (from === '/etc') process.stdout.write(tarOf('etc/', Buffer.alloc(0), '5'));
    else process.stdout.write(tarOf(from.split('/').pop(), Buffer.from(from === '/bin/app' ? 'ELF\0\0\0binary' : 'hello from the container\n')));
  } else if (a.includes(' stats ')) {
    out(
      '\x1b[2J\x1b[H{"BlockIO":"1MB / 0B","CPUPerc":"12.50%","Container":"aaa","MemPerc":"3.10%","MemUsage":"64MiB / 2GiB","NetIO":"1kB / 2kB","PIDs":"7"}\n',
    );
    setTimeout(
      () =>
        out(
          '\x1b[2J\x1b[H{"BlockIO":"2MB / 0B","CPUPerc":"50.00%","Container":"aaa","MemPerc":"4.00%","MemUsage":"80MiB / 2GiB","NetIO":"3kB / 4kB","PIDs":"8"}\n',
        ),
      50,
    );
    setInterval(() => {}, 1 << 30);
  } else if (a.includes(' logs -f')) {
    out('db ready\n');
    process.stderr.write('a warning\n');
    setInterval(() => {}, 1 << 30);
  } else if (a.includes(' rmi ')) {
    fail(
      'Error response from daemon: conflict: unable to remove repository reference "postgres:16" (must force) - container aaa111 is using its referenced image',
    );
  } else {
    out(`${args.at(-1)}\n`);
  }
} else if (tool === 'podman') {
  if (a.startsWith('version')) out('5.2.0\n');
  else if (a.startsWith('ps -a')) {
    json([
      {
        Id: '0123456789abcdef',
        Names: ['api'],
        Image: 'quay.io/app/api:1',
        State: 'running',
        Status: 'Up 4 minutes',
        Ports: [{ host_ip: '', container_port: 8080, host_port: 18080, range: 1, protocol: 'tcp' }],
        Labels: null,
        PodName: 'backend',
      },
      {
        Id: 'fedcba9876543210',
        Names: ['job'],
        Image: 'busybox',
        State: 'exited',
        Status: '',
        Ports: null,
        Labels: { 'io.podman.compose.project': 'tools' },
        PodName: '',
      },
    ]);
  } else if (a.startsWith('images')) json([{ Id: 'abcdefabcdef1234', Names: ['quay.io/app/api:1'], Size: 123456789, Created: 1794000000, Containers: 1 }]);
  else if (a.startsWith('pod ps')) json([{ Id: '9999999999999999', Name: 'backend', Status: 'Running', Containers: [{ Id: 'a' }, { Id: 'b' }] }]);
  else out('ok\n');
} else if (tool === 'kubectl') {
  if (a === 'config get-contexts -o name') out(process.env.FAKE_NO_CONTEXTS ? '' : 'prod\nkind-dev\n');
  else if (a === 'config view -o json')
    json({
      'current-context': 'kind-dev',
      contexts: [
        { name: 'kind-dev', context: { cluster: 'kind', namespace: 'web' } },
        { name: 'prod', context: { cluster: 'p' } },
      ],
    });
  else if (a.startsWith('--context prod')) fail('Unable to connect to the server: dial tcp: lookup prod.example.com: no such host');
  else if (a.includes(' version ')) json({ clientVersion: {}, serverVersion: { gitVersion: 'v1.31.0' } });
  else if (a.includes(' get pods ')) {
    json({
      items: [
        {
          metadata: { name: 'web-7d4-abc', namespace: 'web', creationTimestamp: '2026-11-13T00:00:00Z' },
          spec: { nodeName: 'kind-control-plane', containers: [{ name: 'web' }, { name: 'sidecar' }] },
          status: {
            phase: 'Running',
            containerStatuses: [
              { ready: true, restartCount: 0, state: { running: {} } },
              { ready: false, restartCount: 7, state: { waiting: { reason: 'CrashLoopBackOff' } } },
            ],
          },
        },
        {
          metadata: { name: 'job-1', namespace: 'web' },
          spec: { containers: [{ name: 'job' }] },
          status: { phase: 'Succeeded', containerStatuses: [{ ready: false, restartCount: 0, state: { terminated: { reason: 'Completed' } } }] },
        },
      ],
    });
  } else if (a.includes(' get deployments '))
    json({ items: [{ metadata: { name: 'web', namespace: 'web' }, spec: { replicas: 3 }, status: { readyReplicas: 2 } }] });
  else if (a.includes(' get namespaces ')) out('web default kube-system');
  else if (a.includes(' get services '))
    json({
      items: [
        {
          metadata: { name: 'web', namespace: 'web' },
          spec: { type: 'NodePort', clusterIP: '10.96.0.12', ports: [{ port: 80, nodePort: 30080, protocol: 'TCP' }] },
        },
      ],
    });
  else if (a.includes(' describe pod ')) out('Name:         web-7d4-abc\nNamespace:    web\nEvents:\n  Back-off restarting failed container\n');
  else if (a.includes(' exec ') && a.includes('wc -c')) out('6\nhello\n');
  else if (a.includes(' exec ')) out('regular file\t6\t1794500000\tapp.conf\n');
  else if (a.includes(' logs -f')) {
    out('[pod/web-7d4-abc/web] hello\n');
    setInterval(() => {}, 1 << 30);
  } else out('done\n');
} else if (tool === 'pm2') {
  if (a === 'jlist') {
    out('>>>> In-memory PM2 is out-of-date, do:\n>>>> $ pm2 update\n');
    json([
      {
        pm_id: 0,
        name: 'api',
        pid: 4242,
        monit: { cpu: 3, memory: 52428800 },
        pm2_env: { status: 'online', restart_time: 2, pm_uptime: 1794500000000, pm_cwd: '/srv/api', exec_mode: 'cluster_mode', instances: 4 },
      },
      {
        pm_id: 1,
        name: 'worker',
        pid: 0,
        monit: { cpu: 0, memory: 0 },
        pm2_env: { status: 'errored', restart_time: 15, pm_cwd: '/srv/worker', exec_mode: 'fork_mode' },
      },
    ]);
  } else if (a === '--version') out('5.4.2\n');
  else if (a.startsWith('logs ')) {
    out('api: listening\n');
    setInterval(() => {}, 1 << 30);
  } else out('[PM2] done\n');
} else if (tool === 'tmux') {
  if (a === '-V') out('tmux 3.5a\n');
  else if (a.startsWith('list-sessions')) out('dev\t3\t1\t1794500000\nbuild\t1\t0\t1794400000\n');
  else if (a.startsWith('capture-pane')) out('$ npm run dev\nready on :3000\n');
  else out('');
} else if (tool === 'screen') {
  if (a === '-v') out('Screen version 4.09.01 (GNU) 20-Aug-23\n');
  else if (a === '-ls') {
    out('There are screens on:\n\t4242.work\t(11/13/2026 03:00:00 AM)\t(Detached)\n\t77.pts-1.box\t(Attached)\n2 Sockets in /run/screen/S-me.\n');
    process.exit(1);
  } else out('');
} else {
  fail(`no such tool ${tool}`, 127);
}
