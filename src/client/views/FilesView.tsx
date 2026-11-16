// Files inside a container or a pod: folders to walk, a file to read, and
// (for containers) copy into the project or save to this machine.

import { useState } from 'react';
import { ArrowUp, Copy, Download, File, FileSymlink, Folder, FolderInput, RefreshCw } from 'lucide-react';
import { formatAgo, formatSize, useHost, useProject } from '@hyperpane/sdk/client';
import { NodeInput, ToolButton, cn } from '@hyperpane/ui';
import type { FileContent, FileEntry } from '../../shared/index.ts';
import { ID, useLoad } from '../lib/calls.ts';
import { Loading } from '../ui/controls.tsx';

/** Files inside a container or a pod: folders to walk, a file to read, and
 * (for containers) copy into the project or save to this machine. */
export function FilesView({ request, canCopy }: { request: Record<string, unknown>; canCopy: boolean }) {
  const host = useHost();
  const project = useProject();
  const [dir, setDir] = useState('/');
  const [typed, setTyped] = useState('/');
  const [open, setOpen] = useState<string | null>(null);
  const list = useLoad<FileEntry[]>({ op: 'files', ...request, path: dir });
  const file = useLoad<FileContent>(open ? { op: 'readFile', ...request, path: open } : null);
  const join = (name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`);
  const go = (to: string) => {
    setDir(to);
    setTyped(to);
    setOpen(null);
  };
  const up = dir === '/' ? null : dir.slice(0, dir.lastIndexOf('/')) || '/';
  const copyOut = async (p: string) => {
    if (!project) return host.app.toast('Open a project to copy into it', { error: true });
    try {
      const where = await host.call<string>(ID, { op: 'copyToProject', project: project.id, ...request, path: p });
      host.app.toast(`Copied to ${where} in the project`);
    } catch (e) {
      host.app.toast((e as Error).message, { error: true });
    }
  };
  const save = (p: string, folder: boolean) =>
    void host.app
      .saveStream(ID, { op: 'download', ...request, path: p, folder }, { name: `${p.split('/').pop() || 'root'}${folder ? '.tar' : ''}` })
      .catch((e: Error) => host.app.toast(e.message, { error: true }));

  return (
    <div className="flex min-h-0 flex-1">
      <div className={cn('flex min-h-0 flex-col border-r border-[var(--node-border)]', open ? 'w-1/2' : 'flex-1')}>
        <form
          className="flex items-center gap-1 px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const p = typed.trim().replace(/\/+$/, '') || '/';
            if (p.startsWith('/')) go(p);
          }}
        >
          <ToolButton label="Up" icon={ArrowUp} disabled={!up} onClick={() => up && go(up)} />
          <NodeInput className="min-w-0 flex-1 font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Folder" />
          <ToolButton label="Again" icon={RefreshCw} onClick={list.reload} />
        </form>
        <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
          {list.value === undefined ? (
            <Loading error={list.error} />
          ) : list.value.length === 0 ? (
            <p className="px-2 py-2 text-[var(--node-muted)]">Empty</p>
          ) : (
            list.value.map((f) => {
              const Icon = f.type === 'dir' ? Folder : f.type === 'link' ? FileSymlink : File;
              const p = join(f.name);
              return (
                <div
                  key={f.name}
                  className={cn(
                    'group flex h-6 cursor-default items-center gap-1.5 rounded px-2 hover:bg-[var(--node-hover)]',
                    open === p && 'bg-[var(--node-hover)]',
                  )}
                  onClick={() =>
                    f.type === 'dir' ? go(p) : f.type === 'link' && f.link ? setOpen(f.link.startsWith('/') ? f.link : join(f.link)) : setOpen(p)
                  }
                >
                  <Icon className={cn('size-3.5 flex-none', f.type === 'dir' ? 'text-[var(--ansi-4)]' : 'text-[var(--node-muted)]')} />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {f.name}
                    {f.link && <span className="text-[var(--node-muted)]"> → {f.link}</span>}
                  </span>
                  <span className="w-16 flex-none text-right text-[var(--node-muted)]">{f.type === 'dir' ? '' : formatSize(f.size)}</span>
                  <span className="hidden w-20 flex-none text-right text-[var(--node-muted)] sm:block">{f.mtime ? formatAgo(f.mtime) : ''}</span>
                  {canCopy && (
                    <span className="flex flex-none" onClick={(e) => e.stopPropagation()}>
                      <ToolButton label="Copy into the project" icon={FolderInput} onClick={() => void copyOut(p)} />
                      <ToolButton
                        label={f.type === 'dir' ? 'Save as .tar' : 'Save to this machine'}
                        icon={Download}
                        onClick={() => save(p, f.type === 'dir')}
                      />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      {open && (
        <div className="flex min-h-0 w-1/2 flex-col">
          <div className="flex items-center gap-1 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono">{open}</span>
            {file.value?.text != null && (
              <ToolButton label="Copy the text" icon={Copy} onClick={() => void host.app.clipboardWrite({ text: file.value!.text! })} />
            )}
            {canCopy && <ToolButton label="Save to this machine" icon={Download} onClick={() => save(open, false)} />}
          </div>
          {file.value === undefined ? (
            <Loading error={file.error} />
          ) : file.value.text === null ? (
            <p className="px-3 text-[var(--node-muted)]">Not text ({formatSize(file.value.size)}).</p>
          ) : (
            <pre className="mx-3 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[var(--node-border)] p-2 font-mono text-[11px] leading-4 whitespace-pre select-text">
              {file.value.text}
              {file.value.truncated && <span className="block text-[var(--node-muted)] italic">… the first 1 MB of {formatSize(file.value.size)}</span>}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
