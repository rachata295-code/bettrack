import { describe, expect, it } from 'vitest';
import { breakEvenRounds, breakEvenWinRate, evPerRound, parseProbability, probAtLeastOneWin } from '@/lib/calculations/risk';

describe('risk', () => {
  it('breakEvenWinRate', () => expect(breakEvenWinRate('2.03').startsWith('49.26')).toBe(true));
  it('evPerRound', () => expect(evPerRound('4', '0.4877', '2.03')).toBe('-0.039876'));
  it('probAtLeastOneWin', () => {
    expect(probAtLeastOneWin('0.5', 3)).toBe('0.875');
    expect(probAtLeastOneWin('0.5', 0)).toBe('0');
    expect(probAtLeastOneWin('0.5', 1.5)).toBe('0');
  });
  it('breakEvenRounds', () => {
    expect(breakEvenRounds('8', '4', '2.03')).toBe(2);
    expect(breakEvenRounds('0', '4', '2.03')).toBeNull();
    expect(breakEvenRounds('-1', '4', '2.03')).toBeNull();
    expect(breakEvenRounds('8', '0', '2.03')).toBeNull();
    expect(breakEvenRounds('8', '4', '1')).toBeNull();
  });
  it('parseProbability', () => {
    expect(parseProbability('48.77')).toEqual({ ok: true, value: '0.4877' });
    expect(parseProbability('100').ok).toBe(false);
    expect(parseProbability('0').ok).toBe(false);
    expect(parseProbability('abc').ok).toBe(false);
    expect(parseProbability('-5').ok).toBe(false);
  });
});
