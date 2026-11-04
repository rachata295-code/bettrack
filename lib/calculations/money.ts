import Decimal from 'decimal.js';
import type { Currency, Money } from '@/types';

// High precision so chained multiplications stay exact; rounding happens only on display.
Decimal.set({ precision: 40 });

/** Wrap a pre-validated decimal string. Do not pass raw user input. */
export function D(value: string): Decimal {
  return new Decimal(value);
}

// Plain non-negative decimal only: rejects signs, exponents, commas, "4.", ".5", NaN.
const MONEY_RE = /^\d+(\.\d+)?$/;

export function parseMoneyInput(raw: string): { ok: true; value: Money } | { ok: false } {
  const s = raw.trim();
  if (!MONEY_RE.test(s)) return { ok: false };
  return { ok: true, value: new Decimal(s).toString() };
}

export function isPositive(value: Money): boolean {
  return D(value).gt(0);
}

export function formatMoney(
  value: Money,
  opts: { precision: number; currency?: Currency; signed?: boolean },
): string {
  const rounded = D(value).toDecimalPlaces(opts.precision, Decimal.ROUND_HALF_UP);
  const negative = rounded.isNegative() && !rounded.isZero();
  const [intPart = '0', fracPart] = rounded.abs().toFixed(opts.precision).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;

  let sign = '';
  if (opts.signed) {
    // Zero (after rounding) gets no sign. U+2212 minus is used only when signed.
    if (negative) sign = '−';
    else if (!rounded.isZero()) sign = '+';
  } else if (negative) {
    // Unsigned negatives keep Decimal's plain hyphen-minus.
    sign = '-';
  }
  const out = `${sign}${body}`;
  return opts.currency ? `${out} ${opts.currency}` : out;
}

export function formatPercent(value: string, precision = 2): string {
  return `${D(value).toFixed(precision, Decimal.ROUND_HALF_UP)}%`;
}
