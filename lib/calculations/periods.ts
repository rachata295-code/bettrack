import { TZDate } from '@date-fns/tz';
import { format, subDays, subMonths, subWeeks } from 'date-fns';
import type { Currency, Money, Session } from '@/types';
import { chasingFlags } from './chasing';
import { D } from './money';
import { computeTimeline, type TimelineRow } from './timeline';

// All day/week/month boundaries are Bangkok time so results never depend on the host's timezone.
export const APP_TZ = 'Asia/Bangkok';
export type PeriodUnit = 'day' | 'week' | 'month';

/** Gaps longer than this between rounds are breaks, not play time (Period tab + reality check). */
export const MAX_GAP_MS = 15 * 60_000;

/** Active play time in ms: sum of gaps ≤ MAX_GAP_MS between consecutive timestamps (any order in). */
export function activePlayMs(timesMs: readonly number[]): number {
  const sorted = [...timesMs].sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    if (gap <= MAX_GAP_MS) ms += gap;
  }
  return ms;
}

function at(iso: string | number | Date, tz: string): TZDate {
  return new TZDate(typeof iso === 'string' ? Date.parse(iso) : +iso, tz);
}

function fmt(d: Date, unit: PeriodUnit): string {
  // RRRR = ISO week-year (so 2027-01-01 is 2026-W53); II = ISO week, Monday start.
  if (unit === 'week') return format(d, "RRRR-'W'II");
  return format(d, unit === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');
}

export function dateKey(iso: string, tz: string = APP_TZ): string {
  return fmt(at(iso, tz), 'day');
}

export function periodKey(iso: string, unit: PeriodUnit, tz: string = APP_TZ): string {
  return fmt(at(iso, tz), unit);
}

/**
 * Milliseconds from `now` until the next 00:00 in `tz`, so live views can roll "today"/"this week"
 * over at Bangkok midnight even when nothing else re-renders them.
 */
export function msUntilNextBangkokMidnight(now: Date, tz: string = APP_TZ): number {
  const local = at(now, tz);
  const next = new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + 1, tz);
  return next.getTime() - now.getTime();
}

export interface AnalyticsRow extends TimelineRow {
  sessionId: string;
  sessionName: string;
  chasing: boolean;
}

export interface RowFilter {
  currency: Currency;
  sessionId?: string; // undefined = all sessions
  tags?: string[]; // any-of
}

/**
 * Flattens sessions of ONE currency into time-ordered rows (currencies are never mixed).
 * `flags` supplies the per-round chasing marker; defaults to the guard's chasing rule.
 */
export function collectRows(
  sessions: readonly Session[],
  f: RowFilter,
  flags: (s: Session) => boolean[] = s => chasingFlags(s.rounds),
): AnalyticsRow[] {
  const out: AnalyticsRow[] = [];
  for (const s of sessions) {
    if (s.currency !== f.currency) continue;
    if (f.sessionId !== undefined && s.id !== f.sessionId) continue;
    if (f.tags && f.tags.length > 0 && !f.tags.some(t => s.tags.includes(t))) continue;
    const chasing = flags(s);
    computeTimeline(s.initialBalance, s.rounds).forEach((r, i) =>
      out.push({ ...r, sessionId: s.id, sessionName: s.name, chasing: chasing[i] ?? false }),
    );
  }
  return out.sort(
    (a, b) =>
      Date.parse(a.round.createdAt) - Date.parse(b.round.createdAt) ||
      (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0) ||
      a.index - b.index,
  );
}

export type RangePreset = '7d' | '30d' | '90d' | 'all';

function validDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Round-trip catches impossible dates such as 2026-02-31.
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
}

export function filterRange(
  rows: readonly AnalyticsRow[],
  range: RangePreset | { from: string; to: string },
  now: Date,
  tz: string = APP_TZ,
): AnalyticsRow[] {
  if (range === 'all') return [...rows];
  let from: string;
  let to: string;
  if (typeof range === 'string') {
    const n = parseInt(range, 10);
    to = fmt(at(now, tz), 'day');
    from = fmt(subDays(at(now, tz), n - 1), 'day');
  } else {
    // Bad or inverted input yields an empty result instead of throwing in the UI.
    if (!validDay(range.from) || !validDay(range.to) || range.from > range.to) return [];
    ({ from, to } = range);
  }
  return rows.filter(r => {
    const k = dateKey(r.round.createdAt, tz);
    return k >= from && k <= to;
  });
}

export interface BucketSummary {
  key: string;
  rounds: number;
  wins: number;
  losses: number;
  winRatePct: string;
  wagered: Money;
  payouts: Money;
  pnl: Money;
  roiPct: string;
  maxDrawdown: Money;
  chasing: number;
  playMinutes: number;
}

export function summarize(key: string, rows: readonly AnalyticsRow[]): BucketSummary {
  const sorted = [...rows].sort((a, b) => Date.parse(a.round.createdAt) - Date.parse(b.round.createdAt));
  let wins = 0;
  let chasing = 0;
  let wagered = D('0');
  let payouts = D('0');
  let cum = D('0');
  let peak = D('0');
  let maxDd = D('0');
  sorted.forEach(r => {
    if (r.round.result === 'win') wins++;
    if (r.chasing) chasing++;
    wagered = wagered.plus(r.round.bet);
    payouts = payouts.plus(r.payout);
    cum = cum.plus(r.pnl);
    if (cum.gt(peak)) peak = cum;
    if (peak.minus(cum).gt(maxDd)) maxDd = peak.minus(cum);
  });
  const playMs = activePlayMs(sorted.map(r => Date.parse(r.round.createdAt)));
  const n = sorted.length;
  const pnl = payouts.minus(wagered);
  return {
    key,
    rounds: n,
    wins,
    losses: n - wins,
    winRatePct: n ? D(String(wins)).div(n).mul(100).toString() : '0',
    wagered: wagered.toString(),
    payouts: payouts.toString(),
    pnl: pnl.toString(),
    roiPct: wagered.isZero() ? '0' : pnl.div(wagered).mul(100).toString(),
    maxDrawdown: maxDd.toString(),
    chasing,
    playMinutes: Math.floor(playMs / 60_000),
  };
}

export function bucketize(rows: readonly AnalyticsRow[], unit: PeriodUnit, tz: string = APP_TZ): BucketSummary[] {
  const map = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    const k = periodKey(r.round.createdAt, unit, tz);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return [...map.keys()].sort().map(k => summarize(k, map.get(k) ?? []));
}

export function comparePeriods(
  rows: readonly AnalyticsRow[],
  unit: PeriodUnit,
  now: Date,
  tz: string = APP_TZ,
): { current: BucketSummary; previous: BucketSummary } {
  const nowTz = at(now, tz);
  // Previous key derives from `now`, not from data, so gaps in play still compare to the true prior period.
  const prevTz = unit === 'day' ? subDays(nowTz, 1) : unit === 'week' ? subWeeks(nowTz, 1) : subMonths(nowTz, 1);
  const curKey = fmt(nowTz, unit);
  const prevKey = fmt(prevTz, unit);
  const pick = (key: string) =>
    summarize(key, rows.filter(r => periodKey(r.round.createdAt, unit, tz) === key));
  return { current: pick(curKey), previous: pick(prevKey) };
}
