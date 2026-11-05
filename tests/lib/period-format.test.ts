import { describe, expect, it } from 'vitest';
import { bangkokLocalToIso, isoToBangkokLocal, compareDeltas, formatPlayTime, periodLabel, formatSignedPercent, sortBuckets, timeInTz } from '@/lib/calculations/period-format';
import type { BucketSummary } from '@/lib/calculations/periods';

const b = (over: Partial<BucketSummary>): BucketSummary => ({
  key: 'k', rounds: 0, wins: 0, losses: 0, winRatePct: '0', wagered: '0', payouts: '0', pnl: '0',
  roiPct: '0', maxDrawdown: '0', chasing: 0, playMinutes: 0, ...over,
});

describe('formatPlayTime', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatPlayTime(65)).toBe('1h 05m');
    expect(formatPlayTime(600)).toBe('10h 00m');
    expect(formatPlayTime(5)).toBe('5m');
    expect(formatPlayTime(0)).toBe('0m');
  });
  it('guards bad input', () => {
    expect(formatPlayTime(-3)).toBe('0m');
    expect(formatPlayTime(Number.NaN)).toBe('0m');
  });
});

describe('formatSignedPercent', () => {
  it('uses + and U+2212', () => {
    expect(formatSignedPercent('35.3333', 1)).toBe('+35.3%');
    expect(formatSignedPercent('-100', 1)).toBe('−100.0%');
    expect(formatSignedPercent('0', 1)).toBe('0.0%');
    expect(formatSignedPercent('-0.01', 1)).toBe('0.0%');
  });
});

describe('compareDeltas', () => {
  it('signed deltas for P&L, rounds and win rate', () => {
    const d = compareDeltas(
      b({ pnl: '4.12', rounds: 3, wins: 2, winRatePct: '66.6667' }),
      b({ pnl: '-4', rounds: 1, wins: 0, winRatePct: '0' }),
      2,
    );
    expect(d.pnlText).toBe('+8.12');
    expect(d.roundsText).toBe('+2');
    expect(d.winRateText).toBe('+66.7 pp');
  });
  it('win rate delta is unavailable when either side has no rounds', () => {
    expect(compareDeltas(b({ rounds: 2, winRatePct: '50' }), b({}), 2).winRateText).toBeNull();
    expect(compareDeltas(b({}), b({}), 2).roundsText).toBe('0');
  });
  it('negative deltas use U+2212', () => {
    const d = compareDeltas(b({ pnl: '-1', rounds: 1, winRatePct: '0' }), b({ pnl: '2', rounds: 4, winRatePct: '50' }), 2);
    expect(d.pnlText).toBe('−3.00');
    expect(d.roundsText).toBe('−3');
    expect(d.winRateText).toBe('−50.0 pp');
  });
});

describe('sortBuckets', () => {
  const list = [
    b({ key: '2026-11-02', pnl: '10', rounds: 1, winRatePct: '100' }),
    b({ key: '2026-11-01', pnl: '-2.5', rounds: 5, winRatePct: '20' }),
    b({ key: '2026-11-03', pnl: '9.99', rounds: 3, winRatePct: '33.3' }),
  ];
  it('sorts money with Decimal, not string order', () => {
    expect(sortBuckets(list, 'pnl', 'desc').map(x => x.key)).toEqual(['2026-11-02', '2026-11-03', '2026-11-01']);
  });
  it('sorts by period and numbers', () => {
    expect(sortBuckets(list, 'period', 'asc').map(x => x.key)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(sortBuckets(list, 'rounds', 'asc').map(x => x.rounds)).toEqual([1, 3, 5]);
    expect(sortBuckets(list, 'winRate', 'desc').map(x => x.winRatePct)).toEqual(['100', '33.3', '20']);
  });
  it('does not mutate input', () => {
    sortBuckets(list, 'period', 'asc');
    expect(list[0]!.key).toBe('2026-11-02');
  });
});

describe('timeInTz', () => {
  it('shows Bangkok HH:mm', () => {
    expect(timeInTz('2026-11-04T17:30:00.000Z')).toBe('00:30');
    expect(timeInTz('2026-11-04T03:05:00.000Z')).toBe('10:05');
  });
});

describe('periodLabel', () => {
  it('day and month keys read as dates', () => {
    expect(periodLabel('2026-11-04', 'day')).toBe('4 Nov 2026');
    expect(periodLabel('2026-11', 'month')).toBe('Nov 2026');
  });
  it('ISO week becomes its Monday–Sunday range', () => {
    expect(periodLabel('2026-W45', 'week')).toBe('2–8 Nov 2026');
    expect(periodLabel('2026-W44', 'week')).toBe('26 Oct – 1 Nov 2026');
  });
  it('week crossing a year boundary shows both years', () => {
    expect(periodLabel('2025-W01', 'week')).toBe('30 Dec 2024 – 5 Jan 2025');
    expect(periodLabel('2026-W53', 'week')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
  it('falls back to the raw key when it cannot be parsed', () => {
    expect(periodLabel('nope', 'week')).toBe('nope');
    expect(periodLabel('2026-13', 'month')).toBe('2026-13');
  });
});

describe('bangkok local date-time helpers', () => {
  it('converts Bangkok local time to ISO UTC', () => {
    expect(bangkokLocalToIso('2026-11-05T00:30')).toBe('2026-11-04T17:30:00.000Z');
    expect(bangkokLocalToIso('2026-11-05T12:00')).toBe('2026-11-05T05:00:00.000Z');
  });
  it('rejects malformed or impossible values', () => {
    expect(bangkokLocalToIso('')).toBeNull();
    expect(bangkokLocalToIso('2026-11-05')).toBeNull();
    expect(bangkokLocalToIso('2026-02-31T10:00')).toBeNull();
    expect(bangkokLocalToIso('2026-11-05T25:00')).toBeNull();
    expect(bangkokLocalToIso('nope')).toBeNull();
  });
  it('round-trips back to the datetime-local value', () => {
    expect(isoToBangkokLocal('2026-11-04T17:30:00.000Z')).toBe('2026-11-05T00:30');
    expect(isoToBangkokLocal(bangkokLocalToIso('2026-12-31T23:59')!)).toBe('2026-12-31T23:59');
  });
});
