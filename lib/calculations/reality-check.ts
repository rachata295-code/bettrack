import type { Money, RealityCheckSettings, Round, Session } from '@/types';
import { D } from './money';
import { activePlayMs, APP_TZ, dateKey } from './periods';
import { computeTimeline } from './timeline';

export const DEFAULT_REALITY_CHECK: RealityCheckSettings = { enabled: true, intervalMin: 30 };
export const REALITY_INTERVAL_MIN = 5;
export const REALITY_INTERVAL_MAX = 240;

const validInterval = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= REALITY_INTERVAL_MIN && n <= REALITY_INTERVAL_MAX;

/** Lenient read: anything malformed or out of range becomes the defaults. */
export function sanitizeRealityCheck(raw: unknown): RealityCheckSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_REALITY_CHECK;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== 'boolean' || !validInterval(r.intervalMin)) return DEFAULT_REALITY_CHECK;
  return { enabled: r.enabled, intervalMin: r.intervalMin };
}

/** Strict write: merges the patch and rejects the whole thing if the result is invalid. */
export function validateRealityCheck(
  next: Partial<Record<keyof RealityCheckSettings, unknown>>,
): { ok: true; value: RealityCheckSettings } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (typeof next.enabled !== 'boolean') errors.enabled = 'Must be on or off';
  if (!validInterval(next.intervalMin)) errors.intervalMin = `Enter whole minutes from ${REALITY_INTERVAL_MIN} to ${REALITY_INTERVAL_MAX}`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { enabled: next.enabled as boolean, intervalMin: next.intervalMin as number } };
}

export interface RealityState {
  startedAt: string;
  /** Active play minutes today: gaps > 15 min between rounds are breaks (same rule as the Period tab). */
  activeMin: number;
  dueIndex: number;
  todayRounds: number;
  /** Latest round today is within `intervalMin` of now; the reminder only opens while playing (R19). */
  playing: boolean;
}

/**
 * Today's (Bangkok day) active play for the reminder. null when nothing was recorded today, so it
 * restarts every day. dueIndex = floor(activeMin / intervalMin). Wall-clock time since the first
 * round is NOT used: it would pop up hours later for someone who stopped playing long ago.
 */
export function realityState(
  rounds: readonly Round[],
  now: Date,
  intervalMin: number,
  tz: string = APP_TZ,
): RealityState | null {
  const today = dateKey(now.toISOString(), tz);
  const times: number[] = [];
  let first: { iso: string; ms: number } | null = null;
  let lastMs = -Infinity;
  for (const r of rounds) {
    const ms = Date.parse(r.createdAt);
    if (!Number.isFinite(ms) || dateKey(r.createdAt, tz) !== today) continue;
    times.push(ms);
    if (!first || ms < first.ms) first = { iso: r.createdAt, ms };
    if (ms > lastMs) lastMs = ms;
  }
  if (!first) return null;
  const activeMin = Math.floor(activePlayMs(times) / 60_000);
  const sinceLast = now.getTime() - lastMs;
  return {
    startedAt: first.iso,
    activeMin,
    dueIndex: Math.floor(activeMin / intervalMin),
    todayRounds: times.length,
    playing: sinceLast <= intervalMin * 60_000,
  };
}

/** Sum of P&L of the session's rounds recorded today (Bangkok), full precision. */
export function sessionTodayPnl(session: Session, now: Date, tz: string = APP_TZ): Money {
  const today = dateKey(now.toISOString(), tz);
  return computeTimeline(session.initialBalance, session.rounds)
    .filter(row => dateKey(row.round.createdAt, tz) === today)
    .reduce((sum, row) => sum.plus(row.pnl), D('0'))
    .toString();
}
