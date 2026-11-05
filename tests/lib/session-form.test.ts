import { describe, expect, it } from 'vitest';
import { validateSessionForm, type SessionFormInput } from '@/lib/session-form';

const base: SessionFormInput = {
  name: ' Main ', currency: 'USDT', initialBalance: ' 16.99 ', defaultBet: '4', defaultMultiplier: '2.03', tags: 'a, b ,a,,c',
  stopLossValue: '', stopLossKind: 'amount', takeProfitValue: '', takeProfitKind: 'amount',
};

describe('validateSessionForm', () => {
  it('normalises a valid input', () => {
    const r = validateSessionForm(base);
    expect(r).toEqual({
      ok: true,
      value: { name: 'Main', currency: 'USDT', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03', tags: ['a', 'b', 'c'], guard: null },
    });
  });
  it('accepts initial balance 0', () => expect(validateSessionForm({ ...base, initialBalance: '0' }).ok).toBe(true));
  it('rejects empty and >60 char names', () => {
    for (const name of ['', '   ', 'x'.repeat(61)]) {
      const r = validateSessionForm({ ...base, name });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.name).toBeTruthy();
    }
    expect(validateSessionForm({ ...base, name: 'x'.repeat(60) }).ok).toBe(true);
  });
  it.each(['', '-1', '1e3', '4,00', 'abc', '4.'])('rejects initial balance %j', v => {
    const r = validateSessionForm({ ...base, initialBalance: v });
    expect(!r.ok && r.errors.initialBalance).toBeTruthy();
  });
  it.each(['0', '-4', 'abc', ''])('rejects default bet %j', v => {
    const r = validateSessionForm({ ...base, defaultBet: v });
    expect(!r.ok && r.errors.defaultBet).toBeTruthy();
  });
  it.each(['1', '0.5', 'x'])('rejects multiplier %j', v => {
    const r = validateSessionForm({ ...base, defaultMultiplier: v });
    expect(!r.ok && r.errors.defaultMultiplier).toBeTruthy();
  });
  it('rejects more than 10 unique tags but dedupes first', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`).join(',');
    const r = validateSessionForm({ ...base, tags: eleven });
    expect(!r.ok && r.errors.tags).toBeTruthy();
    expect(validateSessionForm({ ...base, tags: `${eleven.slice(0, -4)},t0,t0` }).ok).toBe(true);
  });
  it('rejects unknown currency', () => {
    const r = validateSessionForm({ ...base, currency: 'EUR' as never });
    expect(!r.ok && r.errors.currency).toBeTruthy();
  });
  it('reports multiple errors at once', () => {
    const r = validateSessionForm({ ...base, name: '', defaultBet: '0' });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['defaultBet', 'name']);
  });
  describe('stop-loss / take-profit', () => {
    it('builds guard from filled fields and trims', () => {
      const r = validateSessionForm({ ...base, stopLossValue: ' 5 ', stopLossKind: 'amount', takeProfitValue: '50', takeProfitKind: 'percent' });
      expect(r.ok && r.value.guard).toEqual({ stopLoss: { kind: 'amount', value: '5' }, takeProfit: { kind: 'percent', value: '50' } });
    });
    it('supports only one limit', () => {
      const r = validateSessionForm({ ...base, takeProfitValue: '3' });
      expect(r.ok && r.value.guard).toEqual({ takeProfit: { kind: 'amount', value: '3' } });
    });
    it('treats blank fields as off', () => {
      const r = validateSessionForm({ ...base, stopLossValue: '   ' });
      expect(r.ok && r.value.guard).toBeNull();
    });
    it.each(['0', '-1', 'abc', '1e2'])('rejects stop-loss %j', v => {
      const r = validateSessionForm({ ...base, stopLossValue: v });
      expect(!r.ok && r.errors.stopLossValue).toBeTruthy();
    });
    it('rejects percent over 100 but allows amount over 100', () => {
      const bad = validateSessionForm({ ...base, takeProfitValue: '101', takeProfitKind: 'percent' });
      expect(!bad.ok && bad.errors.takeProfitValue).toBeTruthy();
      expect(validateSessionForm({ ...base, takeProfitValue: '101', takeProfitKind: 'amount' }).ok).toBe(true);
    });
  });
});
