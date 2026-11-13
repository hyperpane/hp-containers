// A page's frame below its header: its tabs (the one asked for first, else
// the first), and what shows when the thing is gone.

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Btn, Tabs } from '../ui/controls.tsx';

export function Page({ tabs, first, header, children }: { tabs: { id: string; name: string }[]; first?: string; header: React.ReactNode; children(tab: string): React.ReactNode }) {
  const [tab, setTab] = useState(first && tabs.some((x) => x.id === first) ? first : tabs[0].id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      <div className="flex min-h-0 flex-1 flex-col">{children(tab)}</div>
    </div>
  );
}

export function Gone({ onBack, what }: { onBack(): void; what: string }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4 text-[var(--node-muted)]">
      <p>{what} isn’t there any more.</p>
      <Btn icon={ArrowLeft} onClick={onBack}>
        Back
      </Btn>
    </div>
  );
}
