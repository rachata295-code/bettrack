import { describe, expect, it } from 'vitest';
import { realityState, sanitizeRealityCheck, sessionTodayPnl, validateRealityCheck } from '@/lib/calculations/reality-check';
import type { Round, Session } from '@/types';

const r = (createdAt: string, result: 'win' | 'lose' = 'lose', bet = '4'): Round =>
  ({ id: createdAt + result, result, bet, multiplier: '2', createdAt });

describe('realityState', () => {
  it('measures from the first round today (BKK)', () => {
    // first round today 10:00 BKK = 03:00Z
    expect(realityState([r('2026-11-05T03:00:00Z')], new Date('2026-11-05T03:31:00Z'), 30)).toMatchObject({
      startedAt: '2026-11-05T03:00:00Z', elapsedMin: 31, dueIndex: 1, todayRounds: 1,
    });
  });
  it('null when only yesterday has rounds', () => {
    expect(realityState([r('2026-11-04T03:00:00Z')], new Date('2026-11-05T03:31:00Z'), 30)).toBeNull();
    expect(realityState([], new Date(), 30)).toBeNull();
  });
  it('restarts at Bangkok midnight', () => {
    expect(
      realityState([r('2026-11-04T16:50:00Z'), r('2026-11-04T17:10:00Z')], new Date('2026-11-04T17:20:00Z'), 30),
    ).toMatchObject({ elapsedMin: 10, dueIndex: 0, todayRounds: 1 });
  });
  it('dueIndex = floor(elapsed / interval)', () => {
    expect(realityState([r('2026-11-05T03:00:00Z')], new Date('2026-11-05T04:05:00Z'), 30)?.dueIndex).toBe(2);
  });
});

describe('sessionTodayPnl', () => {
  const s = {
    id: 's', name: 'S', currency: 'USDT', initialBalance: '100', defaultBet: '4', defaultMultiplier: '2',
    tags: [], createdAt: '', updatedAt: '',
    rounds: [r('2026-11-04T03:00:00Z', 'lose', '50'), r('2026-11-05T03:00:00Z', 'lose', '4'), r('2026-11-05T03:10:00Z', 'win', '2.3')],
  } as Session;
  it('sums only today rounds, full precision', () => {
    expect(sessionTodayPnl(s, new Date('2026-11-05T04:00:00Z'))).toBe("-1.7");
  });
  it('0 when nothing today', () => {
    expect(sessionTodayPnl(s, new Date('2026-11-07T04:00:00Z'))).toBe('0');
  });
});

describe('validateRealityCheck / sanitize (5-240 integer)', () => {
  it('accepts bounds and rejects outside / non-integer', () => {
    expect(validateRealityCheck({ enabled: true, intervalMin: 5 })).toMatchObject({ ok: true });
    expect(validateRealityCheck({ enabled: false, intervalMin: 240 })).toMatchObject({ ok: true });
    for (const n of [4, 241, 30.5, NaN]) {
      expect(validateRealityCheck({ enabled: true, intervalMin: n })).toMatchObject({ ok: false });
    }
  });
  it('sanitize: out of range -> default 30', () => {
    expect(sanitizeRealityCheck({ enabled: false, intervalMin: 1 })).toEqual({ enabled: true, intervalMin: 30 });
    expect(sanitizeRealityCheck({ enabled: false, intervalMin: 1440 })).toEqual({ enabled: true, intervalMin: 30 });
    expect(sanitizeRealityCheck({ enabled: false, intervalMin: 60 })).toEqual({ enabled: false, intervalMin: 60 });
  });
});
