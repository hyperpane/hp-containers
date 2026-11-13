// What every list is made of: a toolbar (its title, a search, its own
// buttons), a table with columns that share the width, rows that open what
// they show, and the actions on the right of a row.

import { Search } from 'lucide-react';
import { NodeInput, cn } from '@hyperpane/ui';

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

export function Table({ cols, children, empty }: { cols: Col[]; children: React.ReactNode; empty: boolean }) {
  const shown = cols.filter((c): c is Exclude<Col, false> => !!c);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {empty ? (
        <p className="px-3 py-4 text-[var(--node-muted)]">Nothing here.</p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {shown.map((c, i) => (
              <col key={i} style={{ width: c.actions ? c.actions * 24 + 16 : c.w }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[var(--node-bg)]">
            <tr>
              {shown.map((c, i) => (
                <th key={i} className="truncate border-b border-[var(--node-border)] px-2 py-1.5 text-left font-medium text-[var(--node-muted)] first:pl-3">
                  {c.title}
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
