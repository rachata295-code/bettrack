import type { Money, RoundResult } from '@/types';
import { D, formatMoney } from './money';
import type { BucketSummary } from './periods';
import type { TimelineRow } from './timeline';

// This file is the ONLY place money strings become numbers: charting libraries need them.
// Display text is precomputed from the original strings so tooltips never format floats.

export interface BalancePoint {
  round: number;
  balance: number;
  pnl: number;
  result: RoundResult | null;
  balanceText: string;
  pnlText: string;
}

export function balanceSeries(
  initialBalance: Money,
  timeline: readonly TimelineRow[],
  precision: number,
): BalancePoint[] {
  const start: BalancePoint = {
    round: 0,
    balance: Number(initialBalance),
    pnl: 0,
    result: null,
    balanceText: formatMoney(initialBalance, { precision }),
    pnlText: formatMoney('0', { precision }),
  };
  return [
    start,
    ...timeline.map(row => ({
      round: row.index,
      balance: Number(row.balanceAfter),
      pnl: Number(row.pnl),
      result: row.round.result,
      balanceText: formatMoney(row.balanceAfter, { precision }),
      pnlText: formatMoney(row.pnl, { precision, signed: true }),
    })),
  ];
}

export interface BucketPoint {
  key: string;
  pnl: number;
  cumulative: number;
}

export function bucketSeries(buckets: readonly BucketSummary[]): BucketPoint[] {
  // Accumulate in Decimal so 0.1 + 0.2 does not drift before conversion.
  let cum = D('0');
  return buckets.map(b => {
    cum = cum.plus(D(b.pnl));
    return { key: b.key, pnl: Number(b.pnl), cumulative: cum.toNumber() };
  });
}
