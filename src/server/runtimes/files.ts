// Files inside a container or a pod: a folder is listed by a small sh
// script run in it (with `stat`, which busybox and coreutils both have);
// the path goes as an argument, never into the script. A file's bytes are
// shown as text when they are text.

import type { FileContent, FileEntry } from '../../shared/index.ts';

/** Lists "$1": one `type<TAB>size<TAB>mtime<TAB>name` line an entry, and a
 * `-> target` line after each link. */
export const LIST_SCRIPT = [
  'cd -- "$1" || exit 3',
  'for f in .[!.]* ..?* *; do',
  '  [ -e "$f" ] || [ -L "$f" ] || continue',
  '  stat -c "%F\t%s\t%Y\t%n" -- "$f" || exit 4',
  '  if [ -L "$f" ]; then printf "%s\\n" "-> $(readlink -- "$f")"; fi',
  'done',
].join('\n');

export const MAX_TEXT = 1024 * 1024;

/** An absolute path in a container, as an argument: no NUL, not too long. */
export function checkedPath(p: unknown): string {
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 4096 || p.includes('\0')) throw new Error('A path in a container starts with /.');
  return p;
}

export function entriesOf(out: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    if (line.startsWith('-> ') && entries.length) {
      entries[entries.length - 1].link = line.slice(3);
      continue;
    }
    const [kind, sz, mtime, ...name] = line.split('\t');
    if (!name.length) continue;
    const k = kind.toLowerCase();
    entries.push({
      name: name.join('\t'),
      type: k === 'directory' ? 'dir' : k.includes('regular') ? 'file' : k.includes('symbolic link') ? 'link' : 'other',
      size: Number(sz) || 0,
      mtime: Number(mtime) ? Number(mtime) * 1000 : null,
      link: null,
    });
  }
  return entries.sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name));
}

/** Text when it's text (UTF-8, no NULs), else null. */
export function contentOf(path: string, size: number, bytes: Buffer): FileContent {
  const truncated = bytes.length > MAX_TEXT;
  const head = bytes.subarray(0, MAX_TEXT);
  const binary = head.subarray(0, 8000).includes(0);
  let text: string | null = null;
  if (!binary) {
    try {
      text = new TextDecoder('utf-8', { fatal: !truncated }).decode(head);
    } catch {
      text = null;
    }
  }
  return { path, size, text, truncated };
}
