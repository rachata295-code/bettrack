import type { Currency, FeeSettings, FxRates, Money } from '@/types';
import { D, formatMoney, parseMoneyInput } from './money';

export const DEFAULT_FX: FxRates = {};
export const DEFAULT_FEES: FeeSettings = {
  cryptoWithdrawFee: '0',
  tradeFeePct: '0',
  spreadPct: '0',
  thbWithdrawFee: '0',
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const decimal = (v: unknown): Money | null => {
  if (typeof v !== 'string') return null;
  const p = parseMoneyInput(v);
  return p.ok ? p.value : null;
};

/** THB per 1 unit of `currency`; null when the needed rate is not set. */
export function rateToThb(currency: Currency, fx: FxRates): Money | null {
  if (currency === 'THB') return '1';
  const r = currency === 'USDT' ? fx.usdtThb : fx.usdThb;
  return r === undefined ? null : r;
}

/** Converts via THB. Unrounded (display rounds); null when a needed rate is missing. */
export function convert(amount: Money, from: Currency, to: Currency, fx: FxRates): Money | null {
  if (from === to) return D(amount).toString();
  const f = rateToThb(from, fx);
  const t = rateToThb(to, fx);
  if (f === null || t === null) return null;
  return D(amount).mul(f).div(t).toString();
}

type Errors = Record<string, string>;

/** Each key: > 0 sets it, '' / undefined removes it. Unknown keys are ignored. */
export function validateFxPatch(patch: Partial<FxRates>): { ok: true; value: FxRates } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const value: FxRates = {};
  for (const k of ['usdtThb', 'usdThb'] as const) {
    const raw = isRecord(patch) ? patch[k] : undefined;
    if (raw === undefined || (typeof raw === 'string' && raw.trim() === '')) continue;
    const d = typeof raw === 'string' ? decimal(raw.trim()) : null;
    if (d === null || !D(d).gt(0)) errors[k] = 'Enter a rate greater than 0, or leave empty';
    else value[k] = d;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function validateFeesPatch(
  current: FeeSettings,
  patch: Partial<FeeSettings>,
): { ok: true; value: FeeSettings } | { ok: false; errors: Errors } {
  const merged: Record<string, unknown> = { ...current, ...(isRecord(patch) ? patch : {}) };
  const errors: Errors = {};
  const out = { ...DEFAULT_FEES };
  for (const k of ['cryptoWithdrawFee', 'thbWithdrawFee'] as const) {
    const raw = merged[k];
    const d = typeof raw === 'string' ? decimal(raw.trim()) : null;
    if (d === null) errors[k] = 'Enter an amount of 0 or more';
    else out[k] = d;
  }
  for (const k of ['tradeFeePct', 'spreadPct'] as const) {
    const raw = merged[k];
    const d = typeof raw === 'string' ? decimal(raw.trim()) : null;
    if (d === null || D(d).gte(100)) errors[k] = 'Enter a percent from 0 up to (not including) 100';
    else out[k] = d;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: out };
}

/** Lenient reads: anything unusable becomes the defaults (must never block the app). */
export function sanitizeFx(raw: unknown): FxRates {
  if (!isRecord(raw)) return DEFAULT_FX;
  const r = validateFxPatch(raw as Partial<FxRates>);
  return r.ok ? r.value : DEFAULT_FX;
}

export function sanitizeFees(raw: unknown): FeeSettings {
  if (!isRecord(raw)) return DEFAULT_FEES;
  // Every field must be present: a partial object is treated as malformed.
  if (!(Object.keys(DEFAULT_FEES) as (keyof FeeSettings)[]).every(k => k in raw)) return DEFAULT_FEES;
  const r = validateFeesPatch(DEFAULT_FEES, raw as Partial<FeeSettings>);
  return r.ok ? r.value : DEFAULT_FEES;
}

export interface WithdrawalStep {
  label: string;
  value: Money;
}

/**
 * ((amount − cryptoFee) × rate × (1 − spread%) × (1 − tradeFee%)) − thbFee, all unrounded.
 * A negative result is clamped to 0 (nothing reaches the bank), flagged by clampedToZero.
 */
export function netBankWithdrawal(
  amount: Money,
  rate: Money,
  fees: FeeSettings,
): { steps: WithdrawalStep[]; net: Money; clampedToZero: boolean } {
  const afterCrypto = D(amount).minus(fees.cryptoWithdrawFee);
  const converted = afterCrypto.mul(rate);
  const afterSpread = converted.mul(D('1').minus(D(fees.spreadPct).div(100)));
  const afterTrade = afterSpread.mul(D('1').minus(D(fees.tradeFeePct).div(100)));
  const afterThb = afterTrade.minus(fees.thbWithdrawFee);
  const clampedToZero = afterThb.isNegative();
  return {
    steps: [
      { label: 'After crypto withdrawal fee', value: afterCrypto.toString() },
      { label: 'Converted at rate', value: converted.toString() },
      { label: 'After spread', value: afterSpread.toString() },
      { label: 'After trading fee', value: afterTrade.toString() },
      { label: 'After THB withdrawal fee', value: afterThb.toString() },
    ],
    net: clampedToZero ? '0' : afterThb.toString(),
    clampedToZero,
  };
}

/** "≈ 594.65 THB" for non-THB amounts when a rate exists; null otherwise (nothing to show). */
export function approxThbLabel(amount: Money, currency: Currency, fx: FxRates, precision: number): string | null {
  if (currency === 'THB') return null;
  const thb = convert(amount, currency, 'THB', fx);
  return thb === null ? null : `≈ ${formatMoney(thb, { precision, currency: 'THB' })}`;
}
