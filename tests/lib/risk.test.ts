import { describe, expect, it } from 'vitest';
import { breakEvenRounds, currentLoss, houseEdgeExampleP, breakEvenWinRate, evPerRound, parseProbability, probAtLeastOneWin } from '@/lib/calculations/risk';

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
  it('houseEdgeExampleP', () => {
    expect(houseEdgeExampleP('2.03')).toBe('48.77');
    expect(houseEdgeExampleP('2', '2')).toBe('49');
    expect(houseEdgeExampleP('0')).toBeNull();
    expect(houseEdgeExampleP('abc')).toBeNull();
  });
  it('currentLoss', () => {
    expect(currentLoss('16.99', '10.5')).toBe('6.49');
    expect(currentLoss('16.99', '20')).toBe('0');
    expect(currentLoss('16.99', '16.99')).toBe('0');
  });
});
