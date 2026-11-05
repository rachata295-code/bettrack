'use client';

import { SessionTab } from '@/components/analytics/session-tab';
import { useActiveSession } from '@/hooks/use-active-session';

// Seam for Task 8: wrap in <Tabs> with Session | Period. A single-tab Tabs would be a lone
// control with nothing to switch to, so the Session content renders directly until then.
export default function AnalyticsPage() {
  const session = useActiveSession();
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="truncate text-sm text-muted-foreground">{session.name}</p>
      </div>
      <SessionTab />
    </div>
  );
}
