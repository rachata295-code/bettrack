import { describe, expect, it } from 'vitest';
import { recentMultipliers } from '@/lib/calculations/multipliers';
import type { Session } from '@/types';

const baseSession: Session = {
  id: 's', name: 'S', currency: 'USDT', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03',
  rounds: [], tags: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
};
const s = (rounds: Array<[string, string]>): Session => ({
  ...baseSession,
  rounds: rounds.map(([m, t]) => ({ id: m + t, result: 'win', bet: '4', multiplier: m, createdAt: t })),
});

describe('recentMultipliers', () => {
  it('default first, then most recent distinct', () => {
    const a = s([['2.03', '2026-11-01T00:00:00Z'], ['3.5', '2026-11-03T00:00:00Z']]);
    const b = s([['5', '2026-11-02T00:00:00Z'], ['2.0', '2026-11-04T00:00:00Z']]);
    expect(recentMultipliers([a, b], { defaultMultiplier: '2.03' })).toEqual(['2.03', '2', '3.5', '5']);
  });
  it('dedupes equal values written differently', () => {
    const a = s([['2', '2026-11-01T00:00:00Z'], ['2.00', '2026-11-02T00:00:00Z']]);
    expect(recentMultipliers([a], { defaultMultiplier: '2.0' })).toEqual(['2']);
  });
  it('respects limit', () => {
    const a = s(['1.5', '2.5', '3', '4', '6', '8', '10'].map((m, i) => [m, `2026-11-0${i + 1}T00:00:00Z`] as [string, string]));
    expect(recentMultipliers([a], { defaultMultiplier: '2', limit: 4 })).toEqual(['2', '10', '8', '6']);
  });
  it('skips invalid and <= 1 multipliers', () => {
    const a = s([['abc', '2026-11-01T00:00:00Z'], ['1', '2026-11-02T00:00:00Z'], ['1.0', '2026-11-03T00:00:00Z'], ['-3', '2026-11-04T00:00:00Z'], ['4', '2026-11-05T00:00:00Z']]);
    expect(recentMultipliers([a], { defaultMultiplier: '2' })).toEqual(['2', '4']);
  });
});
