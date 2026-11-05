'use client';

import { useMemo, useState } from 'react';
import { CompareCards } from '@/components/analytics/compare-cards';
import { DaySheet } from '@/components/analytics/day-sheet';
import { PeriodFilters, type PeriodFilterState } from '@/components/analytics/period-filters';
import { PeriodTable } from '@/components/analytics/period-table';
import { CalendarHeatmap } from '@/components/charts/calendar-heatmap';
import { PnlBarChart } from '@/components/charts/pnl-bar-chart';
import { useActiveSession } from '@/hooks/use-active-session';
import { useAnalytics, type AnalyticsRange } from '@/hooks/use-analytics';
import { periodKey, type RowFilter } from '@/lib/calculations/periods';
import { bucketSeries } from '@/lib/calculations/series';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { CURRENCIES } from '@/types';

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</div>
  );
}

export function PeriodTab() {
  const active = useActiveSession();
  const sessions = useBetStore(s => s.sessions);
  const precision = useSettingsStore(s => s.precision);

  const [state, setState] = useState<PeriodFilterState>(() => ({
    currency: active.currency, sessionId: 'all', tags: [], range: '30d', from: '', to: '', unit: 'day',
  }));
  const [month, setMonth] = useState(() => periodKey(new Date().toISOString(), 'month'));
  const [day, setDay] = useState<string | null>(null);
  const patch = (p: Partial<PeriodFilterState> | ((s: PeriodFilterState) => Partial<PeriodFilterState>)) =>
    setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));

  // Sanitize against live data: a session or tag may be deleted (or synced away) while the tab is open.
  const currencies = useMemo(() => CURRENCIES.filter(c => sessions.some(s => s.currency === c)), [sessions]);
  const currency = currencies.includes(state.currency) ? state.currency : active.currency;
  const curSessions = useMemo(() => sessions.filter(s => s.currency === currency), [sessions, currency]);
  const sessionId = curSessions.some(s => s.id === state.sessionId) ? state.sessionId : 'all';
  const tagPool = useMemo(
    () => [...new Set((sessionId === 'all' ? curSessions : curSessions.filter(s => s.id === sessionId)).flatMap(s => s.tags))].sort(),
    [curSessions, sessionId],
  );
  const tagsKey = state.tags.filter(t => tagPool.includes(t)).join('\u0000');

  const filter = useMemo<RowFilter>(() => ({
    currency,
    ...(sessionId !== 'all' ? { sessionId } : {}),
    ...(tagsKey ? { tags: tagsKey.split('\u0000') } : {}),
  }), [currency, sessionId, tagsKey]);
  const customInvalid = state.range === 'custom' && (!state.from || !state.to || state.from > state.to);
  const range = useMemo<AnalyticsRange>(
    () => (state.range === 'custom' ? { from: state.from, to: state.to } : state.range),
    [state.range, state.from, state.to],
  );

  const { allRows, rows, buckets, dayBuckets, compare } = useAnalytics(filter, range, state.unit);
  const series = useMemo(() => bucketSeries(buckets, precision), [buckets, precision]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Summaries describe past records only. They do not predict future rounds.</p>
      <PeriodFilters
        state={{ ...state, currency, sessionId, tags: tagsKey ? tagsKey.split('\u0000') : [] }}
        onChange={patch}
        currencies={currencies}
        sessions={curSessions}
        tags={tagPool}
        customInvalid={customInvalid}
      />
      {allRows.length === 0 ? (
        <Empty>No rounds recorded yet for these filters in {currency}. Record rounds in a {currency} session to see daily, weekly and monthly summaries.</Empty>
      ) : (
        <>
          <CompareCards current={compare.current} previous={compare.previous} unit={state.unit} currency={currency} precision={precision} />
          {rows.length === 0 ? (
            <Empty>{customInvalid ? 'Choose a valid date range to see the chart and summary table.' : 'No rounds in this date range. Try a wider range.'}</Empty>
          ) : (
            <section aria-label="P&L per period" className="min-w-0 space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-lg font-semibold">P&amp;L per {state.unit}</h2>
              <PnlBarChart data={series} unit={state.unit} currency={currency} precision={precision} />
            </section>
          )}
          <CalendarHeatmap month={month} onMonthChange={setMonth} dayBuckets={dayBuckets} currency={currency} precision={precision} onSelectDay={setDay} />
          {rows.length > 0 && <PeriodTable buckets={buckets} unit={state.unit} precision={precision} />}
          <DaySheet day={day} onClose={() => setDay(null)} rows={allRows} currency={currency} precision={precision} />
        </>
      )}
    </div>
  );
}
