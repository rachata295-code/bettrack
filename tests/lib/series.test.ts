import { describe, expect, it } from 'vitest';
import { bucketSeries, balanceSeries } from '@/lib/calculations/series';
import { computeTimeline } from '@/lib/calculations/timeline';
import type { BucketSummary } from '@/lib/calculations/periods';
import type { Round } from '@/types';

const r = (result: 'win' | 'lose'): Round =>
  ({ id: crypto.randomUUID(), result, bet: '4', multiplier: '2.03', createdAt: '2026-11-04T10:00:00.000Z' });

describe('balanceSeries', () => {
  it('starts at round 0 and follows the timeline', () => {
    const s = balanceSeries('16.99', computeTimeline('16.99', [r('win'), r('lose')]), 2);
    expect(s).toEqual([
      { round: 0, balance: 16.99, pnl: 0, result: null, balanceText: '16.99', pnlText: '0.00' },
      { round: 1, balance: 21.11, pnl: 4.12, result: 'win', balanceText: '21.11', pnlText: '+4.12' },
      { round: 2, balance: 17.11, pnl: -4, result: 'lose', balanceText: '17.11', pnlText: '−4.00' },
    ]);
  });
  it('empty timeline yields only the start point', () => {
    expect(balanceSeries('10', [], 2)).toHaveLength(1);
  });
  it('text respects precision', () => {
    const s = balanceSeries('1000', computeTimeline('1000', [r('lose')]), 0);
    expect(s[1]!.balanceText).toBe('996');
  });
});

describe('bucketSeries', () => {
  it('accumulates with Decimal', () => {
    const b = ['1', '-3', '2.5'].map((pnl, i) => ({ key: `k${i}`, pnl }) as BucketSummary);
    expect(bucketSeries(b).map(x => x.cumulative)).toEqual([1, -2, 0.5]);
    expect(bucketSeries(b).map(x => x.pnl)).toEqual([1, -3, 2.5]);
  });
  it('avoids float drift', () => {
    const b = ['0.1', '0.2'].map((pnl, i) => ({ key: `k${i}`, pnl }) as BucketSummary);
    expect(bucketSeries(b)[1]!.cumulative).toBe(0.3);
  });
});

describe('bucketSeries display text', () => {
  it('precomputes signed text from Decimal values', () => {
    const b = ['4.12', '-5', '0.885'].map((pnl, i) => ({ key: `k${i}`, pnl }) as BucketSummary);
    const s = bucketSeries(b, 2);
    expect(s.map(x => x.pnlText)).toEqual(['+4.12', '−5.00', '+0.89']);
    expect(s.map(x => x.cumulativeText)).toEqual(['+4.12', '−0.88', '+0.01']);
  });
});
