'use client';

import { useState } from 'react';
import { PeriodTab } from '@/components/analytics/period-tab';
import { SessionTab } from '@/components/analytics/session-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveSession } from '@/hooks/use-active-session';

type AnalyticsTab = 'session' | 'period';

export default function AnalyticsPage() {
  const session = useActiveSession();
  // Component state only: the tab is a view choice, not something worth persisting or putting in the URL.
  const [tab, setTab] = useState<AnalyticsTab>('session');
  // Once opened, the Period tab stays mounted (hidden) so its filters survive switching tabs;
  // not before, so the Session tab never pays for cross-session analytics it doesn't show.
  const [periodVisited, setPeriodVisited] = useState(false);
  if (tab === 'period' && !periodVisited) setPeriodVisited(true);
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        {/* The Period tab spans sessions, so naming the active one there would mislead. */}
        {tab === 'session' && <p className="truncate text-sm text-muted-foreground">{session.name}</p>}
      </div>
      <Tabs value={tab} onValueChange={v => setTab(v as AnalyticsTab)} className="min-w-0">
        <TabsList className="h-11 w-full sm:w-fit">
          <TabsTrigger value="session" className="min-h-9 px-4">Session</TabsTrigger>
          <TabsTrigger value="period" className="min-h-9 px-4">Period</TabsTrigger>
        </TabsList>
        <TabsContent value="session" className="min-w-0 pt-3"><SessionTab /></TabsContent>
        <TabsContent value="period" keepMounted={periodVisited} className="min-w-0 pt-3"><PeriodTab /></TabsContent>
      </Tabs>
    </div>
  );
}
