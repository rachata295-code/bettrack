'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { HistoryCards } from '@/components/history/history-cards';
import { HistoryTable } from '@/components/history/history-table';
import { HistoryToolbar } from '@/components/history/history-toolbar';
import { Button } from '@/components/ui/button';
import { DEFAULT_HISTORY_QUERY, queryHistory, type HistoryQuery } from '@/lib/history-query';
import { useRecordRound } from '@/hooks/use-record-round';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export default function HistoryPage() {
  const { session, timeline } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const [query, setQuery] = useState<HistoryQuery>(DEFAULT_HISTORY_QUERY);
  // Reuse the calculator's undo so the Redo toast behaves identically.
  const { undo } = useRecordRound(session.defaultBet, session.defaultMultiplier);
  const rows = useMemo(() => queryHistory(timeline, query), [timeline, query]);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">History</h1>
      <HistoryToolbar query={query} onChange={setQuery} session={session} timeline={timeline} onUndo={undo} />
      {timeline.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <History className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">No rounds yet</p>
          <Button render={<Link href="/calculator" />}>Go to Calculator</Button>
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <p className="font-medium">No rounds match your filters</p>
              <Button variant="outline" onClick={() => setQuery(DEFAULT_HISTORY_QUERY)}>Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block"><HistoryTable rows={rows} precision={precision} /></div>
              <div className="md:hidden"><HistoryCards rows={rows} precision={precision} /></div>
            </>
          )}
        </>
      )}
    </div>
  );
}
