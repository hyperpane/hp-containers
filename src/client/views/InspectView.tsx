// Everything the manager says about a thing (docker inspect, kubectl get
// -o json, pm2's own), as a tree to search and copy.

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { useHost } from '@hyperpane/sdk/client';
import { JsonTree, NodeInput, ToolButton } from '@hyperpane/ui';
import { useLoad } from '../lib/calls.ts';
import { Loading } from '../ui/controls.tsx';

/** Everything the manager says about a thing, as a tree to search. */
export function InspectView({ request }: { request: Record<string, unknown> }) {
  const host = useHost();
  const { value, error } = useLoad<unknown>({ op: 'inspect', ...request });
  const [find, setFind] = useState('');
  if (value === undefined) return <Loading error={error} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <NodeInput className="min-w-0 flex-1" placeholder="Find a key or a value" value={find} onChange={(e) => setFind(e.target.value)} />
        <ToolButton label="Copy as JSON" icon={Copy} onClick={() => void host.app.clipboardWrite({ text: JSON.stringify(value, null, 2) })} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[11px]">
        <JsonTree value={value} search={find} depth={2} />
      </div>
    </div>
  );
}
