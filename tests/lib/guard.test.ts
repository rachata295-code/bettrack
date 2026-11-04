import { describe, expect, it } from 'vitest';
import {
  chasingFlags, currentLossStreak, DEFAULT_GUARD, formatCountdown, limitHits, resolveLimit,
  riskBand, suggestedBet, todayPnl, wouldChase,
} from '@/lib/calculations/guard';
import { collectRows } from '@/lib/calculations/periods';
import type { Round, Session } from '@/types';

const pct = { mode: 'percent', percent: '10', minBet: '0.1' } as const;
const rounds = (...r: ('W' | 'L')[]): Round[] =>
  r.map((x, i) => ({ id: `r${i}`, result: x === 'W' ? 'win' : 'lose', bet: '4', multiplier: '2.03', createdAt: '2026-11-04T10:00:00Z' }));
const bets = (xs: [string, string][]): Round[] =>
  xs.map(([x, bet], i) => ({ id: `r${i}`, result: x === 'W' ? 'win' : 'lose', bet, multiplier: '2.03', createdAt: '2026-11-04T10:00:00Z' }));
const sess = (id: string, currency: Session['currency'], rs: Round[]): Session =>
  ({ id, name: id, currency, initialBalance: '100', defaultBet: '4', defaultMultiplier: '2.03', rounds: rs, tags: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' });

describe('suggestedBet', () => {
  it('rounds down, floors at minBet, caps at balance', () => {
    expect(suggestedBet('16.99', pct, 2)).toBe('1.69');
    expect(suggestedBet('0.5', pct, 2)).toBe('0.1');
    expect(suggestedBet('0.05', pct, 2)).toBe('0.05');
  });
  it('null for fixed mode or non-positive balance', () => {
    expect(suggestedBet('16.99', { ...pct, mode: 'fixed' }, 2)).toBeNull();
    expect(suggestedBet('0', pct, 2)).toBeNull();
    expect(suggestedBet('-1', pct, 2)).toBeNull();
  });
});

describe('riskBand', () => {
  const bands = { low: '5', high: '20' };
  it('classifies', () => {
    expect(riskBand('4', '16.99', bands)).toMatchObject({ level: 'high' });
    expect(riskBand('0.5', '16.99', bands)!.level).toBe('low');
    expect(riskBand('2', '20', bands)!.level).toBe('medium');
    expect(riskBand('1', '20', bands)!.level).toBe('low'); // boundary 5% is low
    expect(riskBand('4', '20', bands)!.level).toBe('medium'); // boundary 20% is medium
  });
  it('null when balance <= 0', () => expect(riskBand('1', '0', bands)).toBeNull());
});

describe('streak and chasing', () => {
  it('loss streak', () => {
    expect(currentLossStreak(rounds('W', 'L', 'L', 'L'))).toBe(3);
    expect(currentLossStreak(rounds('L', 'W'))).toBe(0);
    expect(currentLossStreak([])).toBe(0);
  });
  it('chasingFlags', () => {
    expect(chasingFlags(bets([['L', '4'], ['W', '8'], ['L', '4'], ['L', '4']]))).toEqual([false, true, false, false]);
    expect(chasingFlags(bets([['L', '4'], ['L', '5']]))).toEqual([false, true]);
  });
  it('wouldChase', () => {
    const rs = bets([['W', '4'], ['L', '4']]);
    expect(wouldChase(rs, '5')).toBe(true);
    expect(wouldChase(rs, '4')).toBe(false);
    expect(wouldChase(bets([['W', '4']]), '9')).toBe(false);
    expect(wouldChase([], '9')).toBe(false);
  });
  it('collectRows marks AnalyticsRow.chasing by default', () => {
    const s = sess('a', 'USDT', bets([['L', '4'], ['L', '5'], ['W', '5']]));
    expect(collectRows([s], { currency: 'USDT' }).map(r => r.chasing)).toEqual([false, true, false]);
  });
});

describe('limits', () => {
  it('resolveLimit', () => {
    expect(resolveLimit({ kind: 'amount', value: '10' }, '100')).toBe('10');
    expect(resolveLimit({ kind: 'percent', value: '20' }, '100')).toBe('20');
  });
  it('limitHits', () => {
    expect(limitHits({ initialBalance: '16.99', balance: '6.99', limits: { stopLoss: { kind: 'amount', value: '10' } }, todayPnl: '-10' })).toEqual(['stop_loss']);
    expect(limitHits({ initialBalance: '100', balance: '120', limits: { takeProfit: { kind: 'percent', value: '20' } }, todayPnl: '20' })).toEqual(['take_profit']);
    expect(limitHits({ initialBalance: '100', balance: '95', todayPnl: '-5', dailyLossLimit: '5' })).toEqual(['daily_loss']);
  });
  it('orders hits and ignores non-positive limits', () => {
    expect(limitHits({
      initialBalance: '100', balance: '90',
      limits: { stopLoss: { kind: 'amount', value: '10' }, takeProfit: { kind: 'amount', value: '0' } },
      todayPnl: '-10', dailyLossLimit: '10',
    })).toEqual(['stop_loss', 'daily_loss']);
    expect(limitHits({ initialBalance: '100', balance: '50', limits: { stopLoss: { kind: 'amount', value: '0' } }, todayPnl: '-50', dailyLossLimit: '0' })).toEqual([]);
  });
  it('not hit below the limit', () => {
    expect(limitHits({ initialBalance: '100', balance: '91', limits: { stopLoss: { kind: 'amount', value: '10' } }, todayPnl: '-9' })).toEqual([]);
  });
});

describe('todayPnl', () => {
  const now = new Date('2026-11-04T12:00:00Z'); // Bangkok 2026-11-04
  const at = (id: string, result: 'win' | 'lose', createdAt: string): Round =>
    ({ id, result, bet: '4', multiplier: '2.03', createdAt });
  it('sums today (Bangkok) across sessions of one currency only', () => {
    const a = sess('a', 'USDT', [
      at('1', 'lose', '2026-11-04T16:59:00Z'), // today
      at('2', 'win', '2026-11-04T17:01:00Z'), // tomorrow in Bangkok
      at('0', 'lose', '2026-11-03T10:00:00Z'), // yesterday
    ].sort((x, y) => x.createdAt.localeCompare(y.createdAt)));
    const b = sess('b', 'USDT', [at('3', 'lose', '2026-11-04T05:00:00Z')]);
    const c = sess('c', 'THB', [at('4', 'lose', '2026-11-04T05:00:00Z')]);
    expect(todayPnl([a, b, c], 'USDT', now)).toBe('-8');
    expect(todayPnl([], 'USDT', now)).toBe('0');
  });
});

describe('formatCountdown / defaults', () => {
  it('formats mm:ss with ceil', () => {
    expect(formatCountdown(299_001)).toBe('05:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(61_000)).toBe('01:01');
    expect(formatCountdown(1)).toBe('00:01');
  });
  it('DEFAULT_GUARD', () => {
    expect(DEFAULT_GUARD).toEqual({
      sizing: { mode: 'percent', percent: '10', minBet: '0.1' },
      riskBands: { low: '5', high: '20' },
      lossStreak: { enabled: true, n: 3, mode: 'soft', cooldownMin: 5 },
      chasingAlert: true,
    });
    expect(DEFAULT_GUARD.dailyLossLimit).toBeUndefined();
  });
});
