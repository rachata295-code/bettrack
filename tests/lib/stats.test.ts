import { describe, expect, it } from 'vitest';
import { computeSessionStats } from '@/lib/calculations/stats';
import { computeTimeline } from '@/lib/calculations/timeline';
import type { Round } from '@/types';

const mk = (result: 'win' | 'lose'): Round => ({
  id: crypto.randomUUID(), result, bet: '4', multiplier: '2.03', createdAt: '2026-11-04T10:00:00.000Z',
});
const win4 = () => mk('win');
const lose4 = () => mk('lose');

describe('computeSessionStats', () => {
  it('spec example: W L L W', () => {
    const t = computeTimeline('16.99', [win4(), lose4(), lose4(), win4()]);
    const s = computeSessionStats('16.99', t);
    expect(s).toMatchObject({
      current: '17.23', initial: '16.99', netPnl: '0.24', rounds: 4, wins: 2, losses: 2, winRatePct: '50',
      wagered: '16', payouts: '16.24', avgPnl: '0.06', largestWin: '4.12', largestLoss: '4',
      highest: '21.11', lowest: '13.11', streak: { type: 'win', count: 1 }, maxDrawdown: '8',
    });
    expect(s.maxDrawdownPct.startsWith('37.8')).toBe(true); // 8 / 21.11
    expect(s.roiPct.startsWith('1.41')).toBe(true); // 0.24 / 16.99
  });
  it('empty history', () => {
    const s = computeSessionStats('16.99', []);
    expect(s.streak).toEqual({ type: null, count: 0 });
    expect(s).toMatchObject({ current: '16.99', netPnl: '0', rounds: 0, winRatePct: '0', avgPnl: '0',
      largestWin: '0', largestLoss: '0', highest: '16.99', lowest: '16.99', maxDrawdown: '0', maxDrawdownPct: '0' });
  });
  it('zero initial balance gives roi 0 and counts a losing streak', () => {
    const s = computeSessionStats('0', computeTimeline('0', [lose4(), lose4()]));
    expect(s.roiPct).toBe('0');
    expect(s.streak).toEqual({ type: 'lose', count: 2 });
    expect(s.largestWin).toBe('0');
  });
});
