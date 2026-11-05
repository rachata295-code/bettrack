import { describe, expect, it } from 'vitest';
import { DEFAULT_GUARD, sanitizeGuard, validateGuardPatch, validateLimitValue } from '@/lib/calculations/guard';

const ok = (patch: object) => validateGuardPatch(DEFAULT_GUARD, patch);

describe('validateGuardPatch', () => {
  it('accepts an empty patch and returns current', () => {
    expect(ok({})).toEqual({ ok: true, value: DEFAULT_GUARD });
  });
  it('merges nested patches without losing siblings', () => {
    const r = ok({ sizing: { percent: '5' }, lossStreak: { n: 4 } });
    expect(r.ok && r.value.sizing).toEqual({ mode: 'percent', percent: '5', minBet: '0.1' });
    expect(r.ok && r.value.lossStreak).toEqual({ enabled: true, n: 4, mode: 'soft', cooldownMin: 5 });
  });
  it.each(['0', '-1', '100.5', 'abc', ''])('rejects sizing percent %j', v => {
    const r = ok({ sizing: { percent: v } });
    expect(!r.ok && r.errors['sizing.percent']).toBeTruthy();
  });
  it('accepts percent 100', () => expect(ok({ sizing: { percent: '100' } }).ok).toBe(true));
  it.each(['0', '-1', 'x'])('rejects minBet %j', v => {
    const r = ok({ sizing: { minBet: v } });
    expect(!r.ok && r.errors['sizing.minBet']).toBeTruthy();
  });
  it('requires low < high within 0-100', () => {
    for (const riskBands of [{ low: '20', high: '20' }, { low: '30', high: '20' }, { low: '5', high: '101' }, { low: '-1', high: '20' }]) {
      const r = ok({ riskBands });
      expect(r.ok).toBe(false);
    }
    expect(ok({ riskBands: { low: '0', high: '100' } }).ok).toBe(true);
  });
  it.each([1, 21, 2.5, Number.NaN])('rejects loss streak n=%s', n => {
    const r = ok({ lossStreak: { n } });
    expect(!r.ok && r.errors['lossStreak.n']).toBeTruthy();
  });
  it.each([0, 121, 1.5])('rejects cooldownMin=%s', cooldownMin => {
    const r = ok({ lossStreak: { cooldownMin } });
    expect(!r.ok && r.errors['lossStreak.cooldownMin']).toBeTruthy();
  });
  it('accepts boundaries n=2/20 and cooldown 1/120', () => {
    expect(ok({ lossStreak: { n: 2, cooldownMin: 1 } }).ok).toBe(true);
    expect(ok({ lossStreak: { n: 20, cooldownMin: 120 } }).ok).toBe(true);
  });
  it('rejects bad mode values', () => {
    expect(ok({ sizing: { mode: 'x' } }).ok).toBe(false);
    expect(ok({ lossStreak: { mode: 'x' } }).ok).toBe(false);
  });
  it('sets, validates and clears dailyLossLimit', () => {
    const set = ok({ dailyLossLimit: '10' });
    expect(set.ok && set.value.dailyLossLimit).toBe('10');
    for (const v of ['0', '-5', 'abc']) {
      const r = ok({ dailyLossLimit: v });
      expect(!r.ok && r.errors.dailyLossLimit).toBeTruthy();
    }
    const withLimit = { ...DEFAULT_GUARD, dailyLossLimit: '10' };
    const cleared = validateGuardPatch(withLimit, { dailyLossLimit: undefined });
    expect(cleared.ok && 'dailyLossLimit' in cleared.value).toBe(false);
    const kept = validateGuardPatch(withLimit, {});
    expect(kept.ok && kept.value.dailyLossLimit).toBe('10');
  });
  it('does not mutate current', () => {
    const before = JSON.stringify(DEFAULT_GUARD);
    ok({ sizing: { percent: '5' } });
    expect(JSON.stringify(DEFAULT_GUARD)).toBe(before);
  });
});

describe('validateLimitValue', () => {
  it('accepts amount and percent', () => {
    expect(validateLimitValue({ kind: 'amount', value: '5' })).toEqual({ kind: 'amount', value: '5' });
    expect(validateLimitValue({ kind: 'percent', value: '100' })).toEqual({ kind: 'percent', value: '100' });
  });
  it.each([
    { kind: 'percent', value: '100.1' }, { kind: 'amount', value: '0' }, { kind: 'amount', value: '-1' },
    { kind: 'amount', value: 'x' }, { kind: 'other', value: '1' }, null, 'x', { kind: 'amount', value: 5 },
  ])('rejects %j', v => expect(validateLimitValue(v)).toBeNull());
});

describe('sanitizeGuard', () => {
  it('returns default for junk and keeps valid values', () => {
    expect(sanitizeGuard(undefined)).toEqual(DEFAULT_GUARD);
    expect(sanitizeGuard('x')).toEqual(DEFAULT_GUARD);
    expect(sanitizeGuard({ sizing: { mode: 'percent', percent: '999', minBet: '1' } })).toEqual(DEFAULT_GUARD);
    const g = { ...DEFAULT_GUARD, chasingAlert: false, dailyLossLimit: '7' };
    expect(sanitizeGuard(g)).toEqual(g);
  });
});
