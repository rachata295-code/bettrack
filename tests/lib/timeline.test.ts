import { describe, expect, it } from 'vitest';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';
import type { Round } from '@/types';

const r = (result: 'win' | 'lose', bet = '4', multiplier = '2.03'): Round =>
  ({ id: crypto.randomUUID(), result, bet, multiplier, createdAt: '2026-11-04T10:00:00.000Z' });

describe('computeTimeline', () => {
  it('spec example: win then lose', () => {
    const t = computeTimeline('16.99', [r('win'), r('lose')]);
    expect(t.map(x => [x.payout, x.pnl, x.balanceAfter])).toEqual([['8.12', '4.12', '21.11'], ['0', '-4', '17.11']]);
    expect(t.map(x => x.index)).toEqual([1, 2]);
    expect(t[1]!.balanceBefore).toBe('21.11');
  });
  it('preserves each round own bet and multiplier', () => {
    const t = computeTimeline('100', [r('win', '4', '2.03'), r('win', '10', '1.5')]);
    expect(t[1]!.pnl).toBe('5'); expect(t[1]!.balanceAfter).toBe('109.12');
  });
  it('editing an earlier round recalculates later balances', () => {
    const rounds = [r('win'), r('lose'), r('win')];
    const edited = rounds.map((x, i) => (i === 0 ? { ...x, result: 'lose' as const } : x));
    expect(computeTimeline('16.99', edited).map(x => x.balanceAfter)).toEqual(['12.99', '8.99', '13.11']);
  });
  it('deleting a middle round recalculates', () => {
    const rounds = [r('win'), r('lose'), r('win')];
    expect(computeTimeline('16.99', [rounds[0]!, rounds[2]!]).at(-1)!.balanceAfter).toBe('25.23');
  });
  it('flags insufficient rows after an edit', () => {
    const t = computeTimeline('5', [r('lose', '4'), r('lose', '4')]);
    expect(t.map(x => x.insufficient)).toEqual([false, true]); expect(t[1]!.balanceAfter).toBe('-3');
  });
});
describe('currentBalance', () => {
  it('empty history -> current = initial', () => expect(currentBalance('16.99', [])).toBe('16.99'));
  it('uses last row balanceAfter', () =>
    expect(currentBalance('16.99', computeTimeline('16.99', [r('win')]))).toBe('21.11'));
});
