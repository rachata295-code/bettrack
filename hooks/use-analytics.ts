'use client';

import { useMemo } from 'react';
import {
  bucketize, collectRows, comparePeriods, filterRange,
  type AnalyticsRow, type BucketSummary, type PeriodUnit, type RangePreset, type RowFilter,
} from '@/lib/calculations/periods';
import { useBetStore } from '@/store/bet-store';

export type AnalyticsRange = RangePreset | { from: string; to: string };

export interface AnalyticsResult {
  /** Rows matching currency/session/tags only; the calendar and comparison use these. */
  allRows: AnalyticsRow[];
  /** allRows narrowed to the date range; the chart and table use these. */
  rows: AnalyticsRow[];
  buckets: BucketSummary[];
  /** Daily buckets of allRows so the calendar can browse any month regardless of range. */
  dayBuckets: BucketSummary[];
  compare: { current: BucketSummary; previous: BucketSummary };
}

/** Callers must memoize `filter` and `range`: they are the memo keys. */
export function useAnalytics(filter: RowFilter, range: AnalyticsRange, unit: PeriodUnit): AnalyticsResult {
  const sessions = useBetStore(s => s.sessions);
  const allRows = useMemo(() => collectRows(sessions, filter), [sessions, filter]);
  const dayBuckets = useMemo(() => bucketize(allRows, 'day'), [allRows]);
  return useMemo(() => {
    // `now` is read per recompute; a page left open past midnight refreshes on the next data change.
    const now = new Date();
    const rows = filterRange(allRows, range, now);
    return {
      allRows,
      rows,
      buckets: bucketize(rows, unit),
      dayBuckets,
      // Comparison ignores the range so "this week" is never truncated by a 7-day window.
      compare: comparePeriods(allRows, unit, now),
    };
  }, [allRows, dayBuckets, range, unit]);
}
