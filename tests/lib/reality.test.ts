import { describe, expect, it } from 'vitest';
import { realityState, sanitizeRealityCheck, sessionTodayPnl, validateRealityCheck } from '@/lib/calculations/reality-check';
import type { Round, Session } from '@/types';

const r = (createdAt: string, result: 'win' | 'lose' = 'lose', bet = '4'): Round =>
  ({ id: createdAt + result, result, bet, multiplier: '2', createdAt });

// BKK = UTC+7: 10:00 BKK = 03:00Z.
const bkk = (hhmm: string, day = '05') => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2026, 10, Number(day), h - 7, m)).toISOString();
};
const every10 = (from: number, to: number) => {
  const out: Round[] = [];
  for (let t = from; t <= to; t += 10) out.push(r(bkk(`${Math.floor(t / 60)}:${t % 60}`)));
  return out;
};

describe('realityState (R19: active play time)', () => {
  it('measures active play = sum of gaps ≤ 15 min between today rounds', () => {
    // 10:00..10:30 every 10 min, then 10:31 → 31 active minutes.
    const rounds = [...every10(600, 630), r(bkk('10:31'))];
    expect(realityState(rounds, new Date(bkk('10:31')), 30)).toMatchObject({
      startedAt: bkk('10:00'), activeMin: 31, dueIndex: 1, todayRounds: 5, playing: true,
    });
  });
  it('gaps over 15 minutes are breaks and do not count', () => {
    const rounds = [r(bkk('10:00')), r(bkk('10:10')), r(bkk('11:00')), r(bkk('11:10'))];
    expect(realityState(rounds, new Date(bkk('11:10')), 30)).toMatchObject({ activeMin: 20, dueIndex: 0 });
  });
  it('rounds 10:00–10:40 then nothing: not playing at 20:00', () => {
    const s = realityState(every10(600, 640), new Date(bkk('20:00')), 30);
    expect(s).toMatchObject({ activeMin: 40, dueIndex: 1, playing: false });
  });
  it('playing only while the latest round is within intervalMin of now', () => {
    const rounds = every10(600, 640);
    expect(realityState(rounds, new Date(bkk('11:10')), 30)?.playing).toBe(true);
    expect(realityState(rounds, new Date(bkk('11:11')), 30)?.playing).toBe(false);
  });
  it('null when only yesterday has rounds', () => {
    expect(realityState([r(bkk('10:00', '04'))], new Date(bkk('10:31')), 30)).toBeNull();
    expect(realityState([], new Date(), 30)).toBeNull();
  });
  it('restarts at Bangkok midnight', () => {
    expect(
      realityState([r(bkk('23:50', '04')), r(bkk('00:10'))], new Date(bkk('00:20')), 30),
    ).toMatchObject({ activeMin: 0, dueIndex: 0, todayRounds: 1, playing: true });
  });
  it('dueIndex = floor(activeMin / interval)', () => {
    expect(realityState(every10(600, 665), new Date(bkk('11:05')), 30)?.dueIndex).toBe(2);
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
