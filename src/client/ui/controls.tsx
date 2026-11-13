// The window's small controls: tabs, a header's button, and what shows while
// something loads (or why it didn't).

import { NodeButton, cn } from '@hyperpane/ui';

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; name: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="flex gap-0.5 border-b border-[var(--node-border)] px-3">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-2.5 py-1.5 text-xs transition-colors duration-100',
            value === t.id ? 'border-[var(--node-accent)] text-[var(--node-fg)]' : 'border-transparent text-[var(--node-muted)] hover:text-[var(--node-fg)]',
          )}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

/** A small button with an icon and words, for a page's header. */
export function Btn({ icon: Icon, children, danger, ...props }: React.ComponentProps<'button'> & { icon: React.ComponentType<{ className?: string }>; danger?: boolean }) {
  return (
    <NodeButton {...props} className={cn(danger && 'hover:border-[var(--ansi-1)] hover:text-[var(--ansi-1)]', props.className)}>
      <Icon />
      {children}
    </NodeButton>
  );
}

export function Loading({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (error) return <p className="px-3 py-3 text-[var(--ansi-1)]">{error}</p>;
  return <p className="px-3 py-3 text-[var(--node-muted)]">{children ?? 'Loading…'}</p>;
}
