import { TZDate } from '@date-fns/tz';
import { addDays, format, isValid, parse } from 'date-fns';
import Decimal from 'decimal.js';
import type { Money } from '@/types';
import { D, formatMoney } from './money';
import { APP_TZ, type BucketSummary, type PeriodUnit } from './periods';

/** "1h 05m" (or "5m" under an hour). Estimated play time is never negative. */
export function formatPlayTime(minutes: number): string {
  const m = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

/** Percent with an explicit + / U+2212 sign (ROI); zero after rounding is unsigned. */
export function formatSignedPercent(value: string, precision = 1): string {
  const r = D(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
  const body = r.abs().toFixed(precision);
  if (r.isZero()) return `${body}%`;
  return `${r.isNegative() ? '−' : '+'}${body}%`;
}

function signedInt(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `−${-n}`;
}

export interface CompareDeltas {
  pnlText: string;
  roundsText: string;
  /** Percentage-point change; null when either period has no rounds (a 0% rate there means nothing). */
  winRateText: string | null;
}

export function compareDeltas(current: BucketSummary, previous: BucketSummary, precision: number): CompareDeltas {
  const pnl: Money = D(current.pnl).minus(D(previous.pnl)).toString();
  let winRateText: string | null = null;
  if (current.rounds > 0 && previous.rounds > 0) {
    const pct = formatSignedPercent(D(current.winRatePct).minus(D(previous.winRatePct)).toString(), 1);
    winRateText = `${pct.slice(0, -1)} pp`;
  }
  return {
    pnlText: formatMoney(pnl, { precision, signed: true }),
    roundsText: signedInt(current.rounds - previous.rounds),
    winRateText,
  };
}

export type BucketSortKey =
  | 'period' | 'rounds' | 'wl' | 'winRate' | 'wagered' | 'pnl' | 'roi' | 'maxDd' | 'chasing' | 'playTime';

function cmp(a: BucketSummary, b: BucketSummary, key: BucketSortKey): number {
  switch (key) {
    case 'period': return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    case 'rounds': return a.rounds - b.rounds;
    case 'wl': return a.wins - b.wins || b.losses - a.losses;
    // Decimal comparisons: string order would put "10" before "9.99".
    case 'winRate': return D(a.winRatePct).cmp(D(b.winRatePct));
    case 'wagered': return D(a.wagered).cmp(D(b.wagered));
    case 'pnl': return D(a.pnl).cmp(D(b.pnl));
    case 'roi': return D(a.roiPct).cmp(D(b.roiPct));
    case 'maxDd': return D(a.maxDrawdown).cmp(D(b.maxDrawdown));
    case 'chasing': return a.chasing - b.chasing;
    case 'playTime': return a.playMinutes - b.playMinutes;
  }
}

export function sortBuckets(buckets: readonly BucketSummary[], key: BucketSortKey, dir: 'asc' | 'desc'): BucketSummary[] {
  const sign = dir === 'asc' ? 1 : -1;
  // Ties fall back to period order so the table never reshuffles unpredictably.
  return [...buckets].sort((a, b) => sign * cmp(a, b, key) || cmp(a, b, 'period'));
}

/** HH:mm in Bangkok time, regardless of the device timezone. */
export function timeInTz(iso: string, tz: string = APP_TZ): string {
  return format(new TZDate(Date.parse(iso), tz), 'HH:mm');
}

// Keys are calendar labels already in Bangkok time, so they are parsed as plain local dates (no tz shift).
const KEY_FORMATS: Record<PeriodUnit, string> = { day: 'yyyy-MM-dd', week: "RRRR-'W'II", month: 'yyyy-MM' };
const REF_DATE = new Date(2000, 0, 1);

/**
 * Human label for a period key: "4 Nov 2026", "2–8 Nov 2026" / "30 Dec 2024 – 5 Jan 2025", "Nov 2026".
 * Display only — CSV export keeps the raw sortable keys.
 */
export function periodLabel(key: string, unit: PeriodUnit): string {
  const d = parse(key, KEY_FORMATS[unit], REF_DATE);
  // date-fns accepts overflowing parts; round-tripping rejects keys like "2026-13".
  if (!isValid(d) || format(d, KEY_FORMATS[unit]) !== key) return key;
  if (unit === 'day') return format(d, 'd MMM yyyy');
  if (unit === 'month') return format(d, 'MMM yyyy');
  const end = addDays(d, 6);
  if (d.getFullYear() !== end.getFullYear()) return `${format(d, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
  if (d.getMonth() !== end.getMonth()) return `${format(d, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  return `${format(d, 'd')}–${format(end, 'd MMM yyyy')}`;
}
