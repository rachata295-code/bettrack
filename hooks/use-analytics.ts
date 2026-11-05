'use client';

import { useMemo } from 'react';
import {
  bucketize, collectRows, comparePeriods, filterRange,
  type AnalyticsRow, type BucketSummary, type PeriodUnit, type RangePreset, type RowFilter,
} from '@/lib/calculations/periods';
import { walletByBucket } from '@/lib/calculations/wallet';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';
import type { Currency } from '@/types';
import { useBangkokDayKey } from './use-bangkok-day-key';

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
  // Recompute range/compare when the Bangkok day changes, even with no new data.
  const today = useBangkokDayKey();
  return useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` is a deliberate recompute trigger.
  }, [allRows, dayBuckets, range, unit, today]);
}

/**
 * Wallet totals aligned to the table's buckets. `missingRates` means transactions exist but cannot be
 * converted; `totals` is null when no transaction falls in any shown bucket (so no columns appear).
 */
export function useWalletColumns(buckets: readonly BucketSummary[], unit: PeriodUnit, currency: Currency) {
  const transactions = useWalletStore(s => s.transactions);
  const fx = useSettingsStore(s => s.fx);
  return useMemo(() => {
    if (transactions.length === 0) return { totals: null, missingRates: false };
    const w = walletByBucket(transactions, unit, currency, fx);
    if ('missingRates' in w) return { totals: null, missingRates: true };
    const overlaps = buckets.some(b => w[b.key] !== undefined);
    return { totals: overlaps ? w : null, missingRates: false };
  }, [transactions, fx, unit, currency, buckets]);
}
