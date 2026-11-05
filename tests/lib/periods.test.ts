import { describe, expect, it } from 'vitest';
import {
  bucketize, collectRows, comparePeriods, dateKey, filterRange, msUntilNextBangkokMidnight, periodKey, summarize,
  type AnalyticsRow,
} from '@/lib/calculations/periods';
import { computeTimeline } from '@/lib/calculations/timeline';
import type { Round, Session } from '@/types';

const rnd = (id: string, result: 'win' | 'lose', createdAt: string, bet = '4'): Round =>
  ({ id, result, bet, multiplier: '2.03', createdAt });
const sess = (id: string, currency: Session['currency'], rounds: Round[], tags: string[] = [], createdAt = '2026-11-01T00:00:00Z'): Session =>
  ({ id, name: `S${id}`, currency, initialBalance: '100', defaultBet: '4', defaultMultiplier: '2.03', rounds, tags, createdAt, updatedAt: createdAt });
const rowsOf = (rounds: Round[]): AnalyticsRow[] =>
  computeTimeline('100', rounds).map(r => ({ ...r, sessionId: 's', sessionName: 'S', chasing: false }));

describe('dateKey / periodKey', () => {
  it('splits Bangkok midnight regardless of host TZ', () => {
    expect(dateKey('2026-11-04T16:59:00Z')).toBe('2026-11-04');
    expect(dateKey('2026-11-04T17:01:00Z')).toBe('2026-11-05');
  });
  it('ISO week starting Monday', () => {
    expect(periodKey('2026-11-01T10:00:00Z', 'week')).toBe('2026-W44');
    expect(periodKey('2026-11-02T10:00:00Z', 'week')).toBe('2026-W45');
    expect(periodKey('2027-01-01T05:00:00Z', 'week')).toBe('2026-W53');
    expect(periodKey('2026-11-30T17:30:00Z', 'month')).toBe('2026-12');
    expect(periodKey('2026-11-04T10:00:00Z', 'day')).toBe('2026-11-04');
  });
});

describe('collectRows', () => {
  const sessions = [
    sess('b', 'USDT', [rnd('b1', 'win', '2026-11-04T10:00:00Z')], ['x']),
    sess('a', 'USDT', [rnd('a1', 'lose', '2026-11-04T10:00:00Z')], ['y']),
    sess('t', 'THB', [rnd('t1', 'win', '2026-11-04T09:00:00Z')], ['x']),
  ];
  it('excludes other currencies, sorts with tie-break, filters tags/session', () => {
    expect(collectRows(sessions, { currency: 'USDT' }).map(r => r.round.id)).toEqual(['a1', 'b1']);
    expect(collectRows(sessions, { currency: 'USDT', tags: ['x'] }).map(r => r.sessionId)).toEqual(['b']);
    expect(collectRows(sessions, { currency: 'USDT', sessionId: 'a' }).map(r => r.sessionId)).toEqual(['a']);
  });
  it('uses the flags callback for chasing', () => {
    const r = collectRows(sessions, { currency: 'USDT', sessionId: 'a' }, () => [true]);
    expect(r[0]?.chasing).toBe(true);
    expect(r[0]?.sessionName).toBe('Sa');
  });
});

describe('summarize', () => {
  const t = (m: number) => `2026-11-04T10:${String(m).padStart(2, '0')}:00Z`;
  it('matches spec example', () => {
    const rows = rowsOf([rnd('1', 'win', t(0)), rnd('2', 'lose', t(5)), rnd('3', 'lose', t(10)), rnd('4', 'win', t(15))]);
    expect(summarize('d', rows)).toMatchObject({
      key: 'd', rounds: 4, wins: 2, losses: 2, winRatePct: '50', wagered: '16',
      payouts: '16.24', pnl: '0.24', roiPct: '1.5', maxDrawdown: '8', playMinutes: 15,
    });
  });
  it('playMinutes ignores gaps over 15 minutes', () => {
    const rows = rowsOf([
      rnd('1', 'win', '2026-11-04T10:00:00Z'), rnd('2', 'win', '2026-11-04T10:10:00Z'),
      rnd('3', 'win', '2026-11-04T11:00:00Z'), rnd('4', 'win', '2026-11-04T11:05:00Z'),
    ]);
    expect(summarize('d', rows).playMinutes).toBe(15);
  });
  it('empty summary has zero strings', () => {
    expect(summarize('k', [])).toMatchObject({ rounds: 0, wagered: '0', pnl: '0', roiPct: '0', winRatePct: '0', maxDrawdown: '0', playMinutes: 0 });
  });
});

describe('filterRange', () => {
  const now = new Date('2026-11-05T03:00:00Z');
  const rows = rowsOf([rnd('out', 'win', '2026-10-29T10:00:00Z'), rnd('in', 'win', '2026-10-30T10:00:00Z'), rnd('t', 'win', '2026-11-05T01:00:00Z')]);
  it('7d includes today and 6 days back (BKK)', () => {
    expect(filterRange(rows, '7d', now).map(r => r.round.id)).toEqual(['in', 't']);
    expect(filterRange(rows, 'all', now)).toHaveLength(3);
  });
  it('custom range inclusive; invalid or inverted is empty', () => {
    expect(filterRange(rows, { from: '2026-10-29', to: '2026-10-30' }, now).map(r => r.round.id)).toEqual(['out', 'in']);
    expect(filterRange(rows, { from: '2026-11-05', to: '2026-10-01' }, now)).toEqual([]);
    expect(filterRange(rows, { from: 'nope', to: '2026-10-01' }, now)).toEqual([]);
  });
});

describe('bucketize / comparePeriods', () => {
  it('buckets by key, ascending, only non-empty', () => {
    const rows = rowsOf([rnd('1', 'win', '2026-11-04T17:30:00Z'), rnd('2', 'win', '2026-11-04T10:00:00Z'), rnd('3', 'lose', '2026-11-06T10:00:00Z')]);
    expect(bucketize(rows, 'day').map(b => [b.key, b.rounds])).toEqual([['2026-11-04', 1], ['2026-11-05', 1], ['2026-11-06', 1]]);
  });
  it('returns empty summaries when no rows', () => {
    const c = comparePeriods([], 'day', new Date('2026-11-05T03:00:00Z'));
    expect(c.current).toMatchObject({ key: '2026-11-05', rounds: 0, pnl: '0' });
    expect(c.previous.key).toBe('2026-11-04');
  });
  it('previous period computed from now (month/week)', () => {
    const rows = rowsOf([rnd('1', 'win', '2026-10-15T10:00:00Z'), rnd('2', 'win', '2026-11-03T10:00:00Z')]);
    const m = comparePeriods(rows, 'month', new Date('2026-11-05T03:00:00Z'));
    expect([m.current.rounds, m.previous.key, m.previous.rounds]).toEqual([1, '2026-10', 1]);
    expect(comparePeriods(rows, 'week', new Date('2026-11-02T03:00:00Z')).previous.key).toBe('2026-W44');
  });
});

describe('msUntilNextBangkokMidnight', () => {
  it('counts to the next 00:00 Bangkok (UTC+7), not host midnight', () => {
    // 2026-11-05 23:59:00 BKK = 16:59:00Z → 60 s left
    expect(msUntilNextBangkokMidnight(new Date('2026-11-05T16:59:00Z'))).toBe(60_000);
    // 00:00:00 BKK exactly → a full day to the next one
    expect(msUntilNextBangkokMidnight(new Date('2026-11-05T17:00:00Z'))).toBe(86_400_000);
    // 12:00 UTC = 19:00 BKK → 5 h
    expect(msUntilNextBangkokMidnight(new Date('2026-11-05T12:00:00Z'))).toBe(5 * 3_600_000);
  });
  it('crosses month and year boundaries', () => {
    expect(msUntilNextBangkokMidnight(new Date('2026-12-31T16:30:00Z'))).toBe(30 * 60_000);
  });
});
