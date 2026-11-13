// Files inside a container or a pod: files and readFile (a folder, a
// file's text); and out of a container: copyToProject and download.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { PluginError } from '@hyperpane/sdk/server';
import { container, name, one, only, said } from '../checks.ts';
import type { Calls, Ctx } from '../context.ts';
import { checkedPath } from '../runtimes/files.ts';
import { firstEntry } from '../tar.ts';

export function fileCalls({ host, runner, target }: Ctx): Calls {
  return {
    files: async ({ target: id, id: thing, path: dir, namespace, container: c }) => {
      const f = await target(id);
      return said(async () => (f.kube ? f.kube.list(f.t, name(thing), one(f.t, namespace), container(c), dir) : only(f, 'engine', 'show files').list(f.t, name(thing), dir)));
    },

    readFile: async ({ target: id, id: thing, path: file, namespace, container: c }) => {
      const f = await target(id);
      return said(async () => (f.kube ? f.kube.read(f.t, name(thing), one(f.t, namespace), container(c), file) : only(f, 'engine', 'show files').read(f.t, name(thing), file)));
    },

    // A file or a folder out of a container, into the project's folder
    // (beside what's there: `name 2`, when it's taken).
    copyToProject: async ({ project, target: id, id: thing, path: file }) => {
      const root = typeof project === 'string' ? host.projectFolder(project) : null;
      if (!root) throw new PluginError('This project’s folder isn’t on this server.');
      const f = await target(id);
      const engine = only(f, 'engine', 'copy files out');
      const base = path.posix.basename(checkedPath(file)) || 'root';
      let to = path.join(root, base);
      for (let i = 2; existsSync(to); i++) to = path.join(root, `${base} ${i}`);
      await said(() => engine.copyOut(f.t, name(thing), file, to));
      return path.relative(root, to);
    },

    // A file's bytes (or a folder as a .tar), for the app to save.
    download: async ({ target: id, id: thing, path: file, folder }) => {
      const f = await target(id);
      const engine = only(f, 'engine', 'download files');
      const child = runner.spawn(engine.tool, engine.copyArgs(f.t, name(thing), file), { stdio: ['ignore', 'pipe', 'ignore'], env: runner.env });
      if (folder) return { data: child.stdout! };
      async function* bytes() {
        try {
          for await (const part of firstEntry(child.stdout!)) if (part instanceof Uint8Array) yield part;
        } finally {
          child.kill();
        }
      }
      return { data: Readable.from(bytes()) };
    },
  };
}
