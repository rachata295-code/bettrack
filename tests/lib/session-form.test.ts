import { describe, expect, it } from 'vitest';
import { validateSessionForm, type SessionFormInput } from '@/lib/session-form';

const base: SessionFormInput = {
  name: ' Main ', currency: 'USDT', initialBalance: ' 16.99 ', defaultBet: '4', defaultMultiplier: '2.03', tags: 'a, b ,a,,c',
};

describe('validateSessionForm', () => {
  it('normalises a valid input', () => {
    const r = validateSessionForm(base);
    expect(r).toEqual({
      ok: true,
      value: { name: 'Main', currency: 'USDT', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03', tags: ['a', 'b', 'c'] },
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
});
