// A choice that opens the app's own menu, for the manager, the namespace,
// a pod's container and a run's restart policy.

import { ChevronDown } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { cn } from '@hyperpane/ui';

/** A choice that opens the app's own menu: its label shortens with an
 * ellipsis instead of running out of its box, as a native select's does. */
export function Picker({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string;
  options: { id: string; label: string; separator?: boolean; disabled?: boolean }[];
  onChange(id: string): void;
  label: string;
  className?: string;
}) {
  const host = useHost();
  const current = options.find((o) => o.id === value);
  return (
    <button
      type="button"
      aria-label={label}
      title={current?.label}
      className={cn(
        'rounded-control flex h-7 w-full min-w-0 items-center gap-1 border border-[var(--node-border)] px-2 text-left hover:bg-[var(--node-hover)] focus-visible:border-[var(--node-accent)] focus-visible:outline-none',
        className,
      )}
      onClick={async (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const id = await host.ui.menu(
          { x: r.left, y: r.bottom + 2 },
          options.map((o) => ({ id: o.id, label: o.id === value ? `✓ ${o.label}` : o.label, separator: o.separator, disabled: o.disabled })),
        );
        if (id && id !== value) onChange(id);
      }}
    >
      <span className="min-w-0 flex-1 truncate">{current?.label ?? label}</span>
      <ChevronDown className="size-3.5 flex-none text-[var(--node-muted)]" />
    </button>
  );
}
