import { describe, expect, it } from 'vitest';
import {
  approxThbLabel, convert, DEFAULT_FEES, netBankWithdrawal, rateToThb, sanitizeFees, sanitizeFx, validateFeesPatch, validateFxPatch,
} from '@/lib/calculations/fx';

const fees = { cryptoWithdrawFee: '1', tradeFeePct: '0.1', spreadPct: '0.5', thbWithdrawFee: '20' };

describe('netBankWithdrawal', () => {
  it('applies fees in order, unrounded', () => {
    const r = netBankWithdrawal('100', '35', fees, 'USDT');
    expect(r.net).toBe('3424.227325');
    expect(r.clampedToZero).toBe(false);
    expect(r.steps.map(s => s.label)).toEqual([
      'After crypto withdrawal fee', 'Converted at rate', 'After spread', 'After trading fee', 'After THB withdrawal fee',
    ]);
    expect(r.steps.map(s => s.value)).toEqual(['99', '3465', '3447.675', '3444.227325', '3424.227325']);
  });
  it('labels each step with its currency: first the withdrawn one, then THB', () => {
    expect(netBankWithdrawal('100', '35', fees, 'USD').steps.map(s => s.currency)).toEqual(['USD', 'THB', 'THB', 'THB', 'THB']);
  });
  it('clamps to zero', () => {
    expect(netBankWithdrawal('1', '35', { ...fees, tradeFeePct: '0', spreadPct: '0' }, 'USDT')).toMatchObject({ net: '0', clampedToZero: true });
  });
});

describe('convert / rateToThb', () => {
  it('converts via THB', () => {
    expect(convert('10', 'USDT', 'THB', { usdtThb: '35' })).toBe('350');
    expect(convert('350', 'THB', 'USDT', { usdtThb: '35' })).toBe('10');
    expect(convert('10', 'USDT', 'USD', { usdtThb: '36', usdThb: '36' })).toBe('10');
  });
  it('null when the rate is missing, identity for same currency', () => {
    expect(convert('10', 'USDT', 'THB', {})).toBeNull();
    expect(convert('10', 'USD', 'USD', {})).toBe('10');
    expect(rateToThb('THB', {})).toBe('1');
    expect(rateToThb('USD', { usdtThb: '35' })).toBeNull();
  });
});

describe('validation', () => {
  it('fx: > 0 sets, empty removes', () => {
    expect(validateFxPatch({ usdtThb: '35.5', usdThb: '' })).toEqual({ ok: true, value: { usdtThb: '35.5' } });
    for (const bad of ['0', '-1', 'abc', '1e3']) expect(validateFxPatch({ usdtThb: bad }).ok).toBe(false);
  });
  it('fees: fee >= 0, pct in [0,100)', () => {
    expect(validateFeesPatch(DEFAULT_FEES, { tradeFeePct: '99.9', thbWithdrawFee: '0' }).ok).toBe(true);
    const r = validateFeesPatch(DEFAULT_FEES, { tradeFeePct: '100', spreadPct: '-1', cryptoWithdrawFee: '' });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['cryptoWithdrawFee', 'spreadPct', 'tradeFeePct']);
  });
  it('sanitize falls back to defaults', () => {
    expect(sanitizeFx({ usdtThb: '-3' })).toEqual({});
    expect(sanitizeFx('x')).toEqual({});
    expect(sanitizeFees({ cryptoWithdrawFee: '1' })).toEqual(DEFAULT_FEES);
    expect(sanitizeFees(fees)).toEqual(fees);
  });
});

describe('approxThbLabel', () => {
  it('shows only for non-THB with a rate', () => {
    expect(approxThbLabel('16.99', 'USDT', { usdtThb: '35' }, 2)).toBe('≈ 594.65 THB');
    expect(approxThbLabel('16.99', 'USDT', {}, 2)).toBeNull();
    expect(approxThbLabel('16.99', 'THB', { usdtThb: '35' }, 2)).toBeNull();
  });
  it('is unsigned by default and signed on request (U+2212 for negatives)', () => {
    expect(approxThbLabel('-1', 'USDT', { usdtThb: '35' }, 2)).toBe('≈ -35.00 THB');
    expect(approxThbLabel('1', 'USDT', { usdtThb: '35' }, 2, { signed: true })).toBe('≈ +35.00 THB');
    expect(approxThbLabel('-1', 'USDT', { usdtThb: '35' }, 2, { signed: true })).toBe('≈ −35.00 THB');
  });
});
