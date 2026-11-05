import { describe, expect, it } from 'vitest';
import { onPlatformBalance, realPnl, validateTransaction } from '@/lib/calculations/wallet';
import type { Currency, Session, Transaction } from '@/types';

const tx = (type: 'deposit' | 'withdraw', amount: string, fee = '0', currency: Currency = 'USDT'): Transaction => ({
  id: amount + type, type, amount, fee, currency, at: '2026-11-04T10:00:00.000Z',
});

describe('realPnl', () => {
  it('sums in one currency', () => {
    expect(realPnl({ transactions: [tx('deposit', '100'), tx('deposit', '50'), tx('withdraw', '80', '1')], onPlatform: '40', currency: 'USDT', fx: {} }))
      .toEqual({ deposits: '150', withdrawals: '80', fees: '1', onPlatform: '40', net: '-31' });
  });
  it('reports missing rates, unique and sorted', () => {
    expect(realPnl({ transactions: [tx('deposit', '350', '0', 'THB')], onPlatform: '0', currency: 'USDT', fx: {} })).toEqual({ missingRates: ['THB'] });
    expect(realPnl({ transactions: [tx('deposit', '1', '0', 'USD'), tx('deposit', '1', '0', 'THB'), tx('withdraw', '1', '1', 'THB')], onPlatform: '0', currency: 'USDT', fx: {} }))
      .toEqual({ missingRates: ['THB', 'USD'] });
  });
  it('converts with a rate, fee in the transaction currency', () => {
    expect(realPnl({ transactions: [tx('deposit', '350', '0', 'THB')], onPlatform: '0', currency: 'USDT', fx: { usdtThb: '35' } }))
      .toMatchObject({ deposits: '10', net: '-10' });
    expect(realPnl({ transactions: [tx('withdraw', '350', '35', 'THB')], onPlatform: '0', currency: 'USDT', fx: { usdtThb: '35' } }))
      .toMatchObject({ withdrawals: '10', fees: '1', net: '9' });
  });
  it('handles no transactions', () => {
    expect(realPnl({ transactions: [], onPlatform: '5', currency: 'THB', fx: {} })).toEqual({ deposits: '0', withdrawals: '0', fees: '0', onPlatform: '5', net: '5' });
  });
});

const sess = (currency: Currency, initial: string, bet?: string): Session => ({
  id: initial + currency, name: 'x', currency, initialBalance: initial, defaultBet: '1', defaultMultiplier: '2',
  rounds: bet ? [{ id: 'r', result: 'win', bet, multiplier: '2', createdAt: '2026-11-04T10:00:00.000Z' }] : [],
  tags: [], createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
});

describe('onPlatformBalance', () => {
  it('sums current balances, converting', () => {
    expect(onPlatformBalance([sess('USDT', '10', '5'), sess('USDT', '20')], 'USDT', {})).toEqual({ value: '35' });
    expect(onPlatformBalance([sess('USDT', '10'), sess('THB', '350')], 'USDT', { usdtThb: '35' })).toEqual({ value: '20' });
  });
  it('reports missing rates', () => {
    expect(onPlatformBalance([sess('USDT', '10'), sess('THB', '350'), sess('USD', '1')], 'USDT', {})).toEqual({ missingRates: ['THB', 'USD'] });
  });
  it('is zero with no sessions', () => {
    expect(onPlatformBalance([], 'USDT', {})).toEqual({ value: '0' });
  });
});

describe('validateTransaction', () => {
  const ok = { type: 'deposit', amount: '100', currency: 'USDT', at: '2026-11-04T10:00:00.000Z' };
  it('accepts and defaults fee, omits empty note', () => {
    expect(validateTransaction({ ...ok, note: '  ' })).toEqual({ ok: true, value: { ...ok, fee: '0' } });
    expect(validateTransaction({ ...ok, fee: '1.5', note: ' hi ' })).toEqual({ ok: true, value: { ...ok, fee: '1.5', note: 'hi' } });
  });
  it('rejects bad fields', () => {
    for (const [k, v] of [['amount', '0'], ['amount', '-1'], ['amount', 'x'], ['fee', '-1'], ['fee', 'abc'], ['currency', 'EUR'], ['type', 'bet'], ['at', 'yesterday'], ['at', '1'], ['note', 'a'.repeat(201)]] as const) {
      const r = validateTransaction({ ...ok, [k]: v });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(Object.keys(r.errors)).toContain(k);
    }
  });
  it('rejects non-objects', () => {
    expect(validateTransaction(null).ok).toBe(false);
    expect(validateTransaction('x').ok).toBe(false);
  });
});
