// `docker cp CONTAINER:PATH -` answers with a tar of PATH. These read it:
// the first entry's header, its bytes (for showing a file), or its bytes
// as they come (for saving a file without its tar around it).

export interface TarHeader {
  name: string;
  size: number;
  /** '0' a file, '5' a folder, '2' a symbolic link… */
  type: string;
  mode: number;
  mtime: number;
  link: string;
}

const text = (b: Uint8Array, at: number, len: number) =>
  Buffer.from(b.subarray(at, at + len))
    .toString('utf8')
    .replace(/\0.*$/s, '');
const octal = (b: Uint8Array, at: number, len: number) => {
  // Big sizes are base-256 (first byte 0x80).
  if (b[at] & 0x80) {
    let n = 0;
    for (let i = at + 1; i < at + len; i++) n = n * 256 + b[i];
    return n;
  }
  return Number.parseInt(text(b, at, len).trim() || '0', 8);
};

export function header(block: Uint8Array): TarHeader | null {
  if (block.length < 512 || block.every((x) => x === 0)) return null;
  const prefix = text(block, 345, 155);
  const name = text(block, 0, 100);
  return {
    name: prefix ? `${prefix}/${name}` : name,
    size: octal(block, 124, 12),
    type: String.fromCharCode(block[156] || 48),
    mode: octal(block, 100, 8),
    mtime: octal(block, 136, 12),
    link: text(block, 157, 100),
  };
}

/** Reads a tar stream: the first real entry (skipping pax and GNU long-name
 * records), and its bytes as they come, up to `limit`. */
export async function* firstEntry(source: AsyncIterable<Uint8Array>, limit = Number.POSITIVE_INFINITY): AsyncGenerator<TarHeader | Uint8Array> {
  let buf = Buffer.alloc(0);
  const it = source[Symbol.asyncIterator]();
  const need = async (n: number) => {
    while (buf.length < n) {
      const r = await it.next();
      if (r.done) return false;
      buf = Buffer.concat([buf, r.value]);
    }
    return true;
  };
  for (;;) {
    if (!(await need(512))) return;
    const h = header(buf.subarray(0, 512));
    buf = buf.subarray(512);
    if (!h) return;
    const padded = Math.ceil(h.size / 512) * 512;
    // Extended headers: skip them and their data.
    if (h.type === 'x' || h.type === 'g' || h.type === 'L' || h.type === 'K') {
      if (!(await need(padded))) return;
      buf = buf.subarray(padded);
      continue;
    }
    yield h;
    let left = Math.min(h.size, limit);
    while (left > 0) {
      if (!buf.length) {
        const r = await it.next();
        if (r.done) return;
        buf = Buffer.from(r.value);
      }
      const take = buf.subarray(0, Math.min(left, buf.length));
      buf = buf.subarray(take.length);
      left -= take.length;
      yield take;
    }
    await it.return?.();
    return;
  }
}
