import Decimal from 'decimal.js';
import type { Currency, Money } from '@/types';
import { D, formatMoney } from './money';
import type { BucketSummary } from './periods';

// Calendar helpers work on plain date keys (already Bangkok-local via dateKey), so they use
// UTC arithmetic purely as a calendar and never depend on the host timezone.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseMonth(yyyyMm: string): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  return m >= 1 && m <= 12 ? { y, m } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Weeks (Monday first) of date keys for a month; null pads the days outside it. */
export function monthGrid(yyyyMm: string): (string | null)[][] {
  const pm = parseMonth(yyyyMm);
  if (!pm) return [];
  const { y, m } = pm;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Sunday=0 → 6
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(yyyyMm: string, delta: number): string {
  const pm = parseMonth(yyyyMm);
  if (!pm) return yyyyMm;
  const total = pm.y * 12 + (pm.m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function monthLabel(yyyyMm: string): string {
  const pm = parseMonth(yyyyMm);
  return pm ? `${MONTHS[pm.m - 1]} ${pm.y}` : yyyyMm;
}

export function dayLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]?.slice(0, 3) ?? ''} ${match[1]}`;
}

/** Largest |P&L| among the month's days; the heat scale is relative to it. */
export function monthMaxAbs(dayBuckets: readonly BucketSummary[], yyyyMm: string): Money {
  let max = D('0');
  for (const b of dayBuckets) {
    if (!b.key.startsWith(`${yyyyMm}-`)) continue;
    const a = D(b.pnl).abs();
    if (a.gt(max)) max = a;
  }
  return max.toString();
}

/** -4..4: sign = profit/loss, magnitude = quartile of |pnl| / maxAbs. 0 = flat or no scale. */
export function heatLevel(pnl: Money, maxAbs: Money): number {
  const v = D(pnl);
  const max = D(maxAbs);
  if (v.isZero() || max.lte(0)) return 0;
  const level = Math.min(4, Math.max(1, v.abs().div(max).mul(4).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber()));
  return v.isNegative() ? -level : level;
}

/** Screen-reader label for a calendar day, e.g. "4 Nov 2026: +4.12 USDT, 3 rounds". */
export function dayCellLabel(key: string, bucket: BucketSummary | undefined, currency: Currency, precision: number): string {
  if (!bucket || bucket.rounds === 0) return `${dayLabel(key)}: no rounds`;
  const n = bucket.rounds;
  return `${dayLabel(key)}: ${formatMoney(bucket.pnl, { precision, signed: true, currency })}, ${n} ${n === 1 ? 'round' : 'rounds'}`;
}
