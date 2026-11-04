import { describe, expect, it } from 'vitest';
import { D, formatMoney, formatPercent, isPositive, parseMoneyInput } from '@/lib/calculations/money';

describe('parseMoneyInput', () => {
  it.each([[' 4 ', '4'], ['16.99', '16.99'], ['2.030', '2.03'], ['0.1', '0.1']])('accepts %j', (raw, v) =>
    expect(parseMoneyInput(raw)).toEqual({ ok: true, value: v }));
  it.each(['', '4,00', '1e3', '-4', 'abc', '4.', '.5', 'NaN', 'Infinity'])('rejects %j', (raw) =>
    expect(parseMoneyInput(raw).ok).toBe(false));
});
describe('isPositive', () => {
  it('is true only for > 0', () => {
    expect(isPositive('0.01')).toBe(true);
    expect(isPositive('0')).toBe(false);
    expect(isPositive('-1')).toBe(false);
  });
});
describe('formatMoney', () => {
  it('rounds half up for display only', () => expect(formatMoney('1.005', { precision: 2 })).toBe('1.01'));
  it('adds currency and grouping', () => expect(formatMoney('1234.5', { precision: 2, currency: 'USDT' })).toBe('1,234.50 USDT'));
  it('signs positive and negative', () => {
    expect(formatMoney('4.12', { precision: 2, signed: true })).toBe('+4.12');
    expect(formatMoney('-4', { precision: 2, signed: true })).toBe('−4.00');
    expect(formatMoney('0', { precision: 2, signed: true })).toBe('0.00');
  });
  it('drops sign when value rounds to zero', () => expect(formatMoney('-0.001', { precision: 2, signed: true })).toBe('0.00'));
  it('groups large values and supports precision 0', () => expect(formatMoney('1234567.5', { precision: 0 })).toBe('1,234,568'));
  it('unsigned negative uses plain hyphen', () => expect(formatMoney('-1234.5', { precision: 2 })).toBe('-1,234.50'));
});
describe('formatPercent', () => {
  it('defaults to 2 decimals', () => expect(formatPercent('12.345')).toBe('12.35%'));
  it('honours precision', () => expect(formatPercent('50', 0)).toBe('50%'));
});
it('avoids float error', () => expect(D('0.1').plus(D('0.2')).toString()).toBe('0.3'));
