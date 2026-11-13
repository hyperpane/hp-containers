// Text a call answers, shown as it is: kubectl describe, or a screen or
// tmux session's screen (looked at again every few seconds).

import { useEffect } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { ToolButton } from '@hyperpane/ui';
import { ANSI } from '../lib/ansi.ts';
import { useLoad } from '../lib/calls.ts';
import { Loading } from '../ui/controls.tsx';

/** Text a call answers (kubectl describe, a session's screen). */
export function TextView({ request, every }: { request: Record<string, unknown>; every?: number }) {
  const host = useHost();
  const { value, error, reload } = useLoad<string>(request);
  useEffect(() => {
    if (!every) return;
    const timer = setInterval(reload, every);
    return () => clearInterval(timer);
  }, [every]);
  if (value === undefined) return <Loading error={error} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end gap-1 px-3 py-1">
        <ToolButton label="Again" icon={RefreshCw} onClick={reload} />
        <ToolButton label="Copy" icon={Copy} onClick={() => void host.app.clipboardWrite({ text: value })} />
      </div>
      <pre className="mx-3 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[var(--node-border)] p-2 font-mono text-[11px] leading-4 whitespace-pre select-text">{value.replace(ANSI, '')}</pre>
    </div>
  );
}
