import { describe, expect, it } from 'vitest';
import { DEFAULT_HISTORY_QUERY, queryHistory } from '@/lib/history-query';
import { computeTimeline } from '@/lib/calculations/timeline';
import type { Round } from '@/types';

const mk = (id: string, result: 'win' | 'lose', bet: string, createdAt: string, note?: string): Round => ({
  id, result, bet, multiplier: '2', createdAt, ...(note ? { note } : {}),
});
// Noon Bangkok time (05:00Z) keeps the Asia/Bangkok date stable.
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 5, 0, 0)).toISOString();
const rows = computeTimeline('100', [
  mk('a', 'win', '4', day(1)),
  mk('b', 'lose', '10', day(2), 'tilt?'),
  mk('c', 'win', '4', day(3), 'Calm'),
]);
const idx = (q: Partial<typeof DEFAULT_HISTORY_QUERY>) =>
  queryHistory(rows, { ...DEFAULT_HISTORY_QUERY, ...q }).map(r => r.index);

describe('queryHistory', () => {
  it('defaults to newest first', () => expect(idx({})).toEqual([3, 2, 1]));
  it('filters by result', () => {
    const out = queryHistory(rows, { ...DEFAULT_HISTORY_QUERY, result: 'win' });
    expect(out.every(r => r.round.result === 'win')).toBe(true);
    expect(out).toHaveLength(2);
  });
  it('searches note case-insensitively', () => expect(idx({ search: 'TILT' })).toEqual([2]));
  it('searches by round number with or without #', () => {
    expect(idx({ search: '#2' })).toEqual([2]);
    expect(idx({ search: ' 3 ' })).toEqual([3]);
  });
  it('filters by local date range, inclusive', () => {
    expect(idx({ from: '2026-11-02', to: '2026-11-02' })).toEqual([2]);
    expect(idx({ from: '2026-11-02' })).toEqual([3, 2]);
    expect(idx({ to: '2026-11-01' })).toEqual([1]);
  });
  it('sorts by pnl asc (loss first)', () => {
    const out = queryHistory(rows, { ...DEFAULT_HISTORY_QUERY, sort: 'pnl', dir: 'asc' });
    expect(out[0]!.round.result).toBe('lose');
  });
  it('sorts by bet desc with ties broken by index', () => {
    expect(idx({ sort: 'bet', dir: 'desc' })).toEqual([2, 1, 3]);
  });
  it('sorts by result and does not mutate input', () => {
    const before = rows.map(r => r.index);
    expect(idx({ sort: 'result', dir: 'asc' })).toEqual([2, 1, 3]);
    expect(rows.map(r => r.index)).toEqual(before);
  });
});

describe('step 7 scenario (lib level)', () => {
  it('W,L,W then round 1 edited to L ends at 13.11 (was 21.23)', () => {
    const r = (id: string, result: 'win' | 'lose'): Round => ({ id, result, bet: '4', multiplier: '2.03', createdAt: day(1) });
    const last = (rs: Round[]) => computeTimeline('16.99', rs).at(-1)!.balanceAfter;
    expect(last([r('1', 'win'), r('2', 'lose'), r('3', 'win')])).toBe('21.23');
    expect(last([r('1', 'lose'), r('2', 'lose'), r('3', 'win')])).toBe('13.11');
  });

  it('from/to use Bangkok dates', () => {
    const r = computeTimeline('100', [mk('x', 'win', '4', '2026-11-04T17:30:00Z')]);
    const q = { ...DEFAULT_HISTORY_QUERY, from: '2026-11-05', to: '2026-11-05' };
    expect(queryHistory(r, q)).toHaveLength(1);
    expect(queryHistory(r, { ...q, from: '2026-11-04', to: '2026-11-04' })).toHaveLength(0);
  });
});
