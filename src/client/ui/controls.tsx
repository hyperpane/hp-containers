// The window's small controls: a header's button, and what shows while
// something loads (or why it didn't).

import { NodeButton } from '@hyperpane/ui';

/** A small button with an icon and words, for a page's header. */
export function Btn({ icon: Icon, children, danger, ...props }: React.ComponentProps<'button'> & { icon: React.ComponentType<{ className?: string }>; danger?: boolean }) {
  return (
    <NodeButton {...props} variant={danger ? 'danger' : 'default'}>
      <Icon />
      {children}
    </NodeButton>
  );
}

export function Loading({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (error) return <p className="px-3 py-3 text-[var(--ansi-1)]">{error}</p>;
  return <p className="px-3 py-3 text-[var(--node-muted)]">{children ?? 'Loading'}</p>;
}
