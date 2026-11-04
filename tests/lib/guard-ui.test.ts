import { describe, expect, it } from 'vitest';
import {
  evaluateSessionLimits, formatLimitHit, isSameAmount, limitHitDetails,
} from '@/lib/calculations/guard';
import type { Round, Session } from '@/types';

const round = (id: string, result: 'win' | 'lose', bet: string, createdAt: string): Round =>
  ({ id, result, bet, multiplier: '2', createdAt });
const sess = (over: Partial<Session>): Session => ({
  id: 's1', name: 's1', currency: 'USDT', initialBalance: '20', defaultBet: '4', defaultMultiplier: '2',
  rounds: [], tags: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
});

describe('limitHitDetails', () => {
  it('returns signed current value and resolved limit per hit', () => {
    const d = limitHitDetails({
      initialBalance: '20', balance: '10', todayPnl: '-10', dailyLossLimit: '5',
      limits: { stopLoss: { kind: 'percent', value: '50' }, takeProfit: { kind: 'amount', value: '5' } },
    });
    expect(d).toEqual([
      { hit: 'stop_loss', label: 'Stop-loss reached', current: '-10', limit: '10' },
      { hit: 'daily_loss', label: 'Daily loss limit reached', current: '-10', limit: '5' },
    ]);
  });
  it('take-profit carries a positive current value', () => {
    const d = limitHitDetails({ initialBalance: '20', balance: '26', todayPnl: '6', limits: { takeProfit: { kind: 'amount', value: '5' } } });
    expect(d).toEqual([{ hit: 'take_profit', label: 'Take-profit reached', current: '6', limit: '5' }]);
  });
  it('empty when nothing is hit', () => {
    expect(limitHitDetails({ initialBalance: '20', balance: '20', todayPnl: '0' })).toEqual([]);
  });
});

describe('formatLimitHit', () => {
  it('formats with U+2212 minus and currency on the limit', () => {
    expect(formatLimitHit({ hit: 'stop_loss', label: 'Stop-loss reached', current: '-10', limit: '10' }, 2, 'USDT'))
      .toBe('Stop-loss reached: −10.00 / 10.00 USDT');
    expect(formatLimitHit({ hit: 'take_profit', label: 'Take-profit reached', current: '6', limit: '5' }, 2, 'USDT'))
      .toBe('Take-profit reached: +6.00 / 5.00 USDT');
  });
});

describe('evaluateSessionLimits', () => {
  const now = new Date('2026-11-05T05:00:00Z'); // 12:00 Bangkok
  it('uses the timeline balance and same-currency today P&L', () => {
    const s = sess({
      guard: { stopLoss: { kind: 'amount', value: '5' } },
      rounds: [round('a', 'lose', '4', '2026-11-05T01:00:00Z'), round('b', 'lose', '4', '2026-11-05T02:00:00Z')],
    });
    const other = sess({ id: 's2', currency: 'THB', rounds: [round('c', 'lose', '100', '2026-11-05T01:00:00Z')], initialBalance: '1000' });
    const d = evaluateSessionLimits({ session: s, sessions: [s, other], dailyLossLimit: '8', now });
    expect(d.map(x => x.hit)).toEqual(['stop_loss', 'daily_loss']);
    expect(d[1]!.current).toBe('-8');
  });
  it('ignores rounds from a different Bangkok day for the daily limit', () => {
    const s = sess({ rounds: [round('a', 'lose', '4', '2026-11-04T10:00:00Z')] });
    expect(evaluateSessionLimits({ session: s, sessions: [s], dailyLossLimit: '1', now })).toEqual([]);
  });
});

describe('isSameAmount', () => {
  it('compares decimals numerically and treats invalid input as different', () => {
    expect(isSameAmount('1.69', '1.690')).toBe(true);
    expect(isSameAmount('1.69', ' 1.69 ')).toBe(true);
    expect(isSameAmount('1.69', '4')).toBe(false);
    expect(isSameAmount('1.69', 'abc')).toBe(false);
    expect(isSameAmount('1.69', '')).toBe(false);
  });
});
