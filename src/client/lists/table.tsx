// What every list is made of: a toolbar (its title, a search, its own
// buttons), a table with columns that share the width, rows that open what
// they show, and the actions on the right of a row. The first column takes
// what's left; the others are as wide as they were dragged (from their left
// edge, kept on this machine per table).

import { Search } from 'lucide-react';
import { ColumnResizer, NodeInput, cn, styles, useColumnWidths } from '@hyperpane/ui';

export function Toolbar({ title, filter, setFilter, children }: { title: string; filter: string; setFilter(v: string): void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--node-border)] px-3 py-2">
      <h2 className="mr-1 text-sm font-semibold">{title}</h2>
      <div className="relative min-w-24 flex-1">
        <Search className="absolute top-1.5 left-1.5 size-3 text-[var(--node-muted)]" />
        <NodeInput className="w-full pl-6" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {children}
    </div>
  );
}

/** A column: its title, and its share of the width (`actions`: the
 * buttons' own width, kept on the right). */
export type Col = { title: string; w?: string; actions?: number } | false;

/** The width a table is laid out for at first: each column's share of it
 * becomes its first width in pixels. */
const AS_WIDE = 640;

/** Each sized column's first width: its share of `AS_WIDE`, or (without
 * one) an even part of what the others leave. */
function firstWidths(shown: Exclude<Col, false>[]): Record<string, number> {
  const pct = (c: Exclude<Col, false>) => (c.w?.endsWith('%') ? (parseFloat(c.w) / 100) * AS_WIDE : c.w ? parseFloat(c.w) : 0);
  const fixed = shown.reduce((n, c) => n + (c.actions ? c.actions * 24 + 16 : pct(c)), 0);
  const free = shown.filter((c) => !c.actions && !c.w).length;
  const even = Math.max(72, (AS_WIDE - fixed) / Math.max(1, free));
  const out: Record<string, number> = {};
  for (const c of shown.slice(1)) if (!c.actions) out[c.title] = Math.round(c.w ? pct(c) : even);
  return out;
}

export function Table({ id, cols, children, empty }: { id: string; cols: Col[]; children: React.ReactNode; empty: boolean }) {
  const shown = cols.filter((c): c is Exclude<Col, false> => !!c);
  const first = firstWidths(shown);
  const sized = useColumnWidths(`containers.${id}`, first, { min: 40, max: 600 });
  // A column shown only when the pane is wide wasn't there at first.
  const width = (title: string) => sized.widths[title] ?? first[title];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {empty ? (
        <p className="px-3 py-4 text-[var(--node-muted)]">Nothing here</p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {shown.map((c, i) => (
              <col key={i} style={{ width: c.actions ? c.actions * 24 + 16 : i === 0 ? undefined : width(c.title) }} />
            ))}
          </colgroup>
          <thead className={cn(styles.stickyTableHead, 'bg-[var(--node-bg)]')}>
            <tr>
              {shown.map((c, i) => (
                <th
                  key={i}
                  className="relative truncate border-b border-[var(--node-border)] px-2 py-1.5 text-left font-medium text-[var(--node-muted)] first:pl-3"
                >
                  {c.title}
                  {i > 0 && !c.actions && (
                    <ColumnResizer
                      edge="start"
                      width={width(c.title)}
                      onResize={(w) => sized.set(c.title, w)}
                      onReset={() => sized.set(c.title, first[c.title])}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </div>
  );
}

export function Tr({ onClick, children }: { onClick?(): void; children: React.ReactNode }) {
  return (
    <tr className={cn('group border-b border-[var(--node-border)] hover:bg-[var(--node-hover)]', onClick && 'cursor-pointer')} onClick={onClick}>
      {children}
    </tr>
  );
}

export const td = 'truncate px-2 py-1.5 align-middle first:pl-3';
/** Actions in a row: always there, on the right; clicks kept from opening
 * the row. */
export function Acts({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-1 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end">{children}</div>
    </td>
  );
}
