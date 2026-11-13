// Files inside a container or a pod: a folder's entries, and a file's text.

export interface FileEntry {
  name: string;
  type: 'dir' | 'file' | 'link' | 'other';
  size: number;
  /** Milliseconds since 1970. */
  mtime: number | null;
  /** Where a link points. */
  link: string | null;
}

export interface FileContent {
  path: string;
  size: number;
  /** Its text, when it's text (the first 1 MB). */
  text: string | null;
  truncated: boolean;
}
