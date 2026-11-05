import type { Currency, Money, RoundResult } from '@/types';
import type { SimResult } from './montecarlo';
import { D, formatMoney, formatPercent } from './money';
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
  pnlText: string;
  cumulativeText: string;
}

export function bucketSeries(buckets: readonly BucketSummary[], precision = 2): BucketPoint[] {
  // Accumulate in Decimal so 0.1 + 0.2 does not drift before conversion.
  let cum = D('0');
  return buckets.map(b => {
    cum = cum.plus(D(b.pnl));
    const cumStr = cum.toString();
    return {
      key: b.key,
      pnl: Number(b.pnl),
      cumulative: cum.toNumber(),
      pnlText: formatMoney(b.pnl, { precision, signed: true }),
      cumulativeText: formatMoney(cumStr, { precision, signed: true }),
    };
  });
}

/**
 * Simulator outputs are floats (see montecarlo.ts). Convert to a fixed-point string first so
 * formatMoney only ever sees decimal strings.
 */
export function simMoney(n: number, precision: number, currency?: Currency): string {
  return formatMoney(n.toFixed(8), { precision, currency });
}

/** Probability in 0..1 shown as a percent with 1 decimal. */
export function simPercent(prob: number): string {
  return formatPercent((prob * 100).toFixed(8), 1);
}

export interface BandPoint {
  round: number;
  p10: number;
  p50: number;
  p90: number;
  /** [p10, p90] for the Recharts range Area. */
  range: [number, number];
  p10Text: string;
  p50Text: string;
  p90Text: string;
}

export function bandSeries(result: SimResult, precision: number): BandPoint[] {
  return result.bands.map(b => ({
    round: b.round,
    p10: b.p10,
    p50: b.p50,
    p90: b.p90,
    range: [b.p10, b.p90],
    p10Text: simMoney(b.p10, precision),
    p50Text: simMoney(b.p50, precision),
    p90Text: simMoney(b.p90, precision),
  }));
}
