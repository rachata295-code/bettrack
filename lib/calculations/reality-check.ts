import type { Money, RealityCheckSettings, Round, Session } from '@/types';
import { D } from './money';
import { APP_TZ, dateKey } from './periods';
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
  elapsedMin: number;
  dueIndex: number;
  todayRounds: number;
}

/**
 * Time since the first round of today (Bangkok day), in whole minutes. null when nothing was
 * recorded today, so the reminder restarts every day. dueIndex counts how many intervals have passed.
 */
export function realityState(
  rounds: readonly Round[],
  now: Date,
  intervalMin: number,
  tz: string = APP_TZ,
): RealityState | null {
  const today = dateKey(now.toISOString(), tz);
  let first: { iso: string; ms: number } | null = null;
  let count = 0;
  for (const r of rounds) {
    const ms = Date.parse(r.createdAt);
    if (!Number.isFinite(ms) || dateKey(r.createdAt, tz) !== today) continue;
    count++;
    if (!first || ms < first.ms) first = { iso: r.createdAt, ms };
  }
  if (!first) return null;
  const elapsedMin = Math.max(0, Math.floor((now.getTime() - first.ms) / 60_000));
  return { startedAt: first.iso, elapsedMin, dueIndex: Math.floor(elapsedMin / intervalMin), todayRounds: count };
}

/** Sum of P&L of the session's rounds recorded today (Bangkok), full precision. */
export function sessionTodayPnl(session: Session, now: Date, tz: string = APP_TZ): Money {
  const today = dateKey(now.toISOString(), tz);
  return computeTimeline(session.initialBalance, session.rounds)
    .filter(row => dateKey(row.round.createdAt, tz) === today)
    .reduce((sum, row) => sum.plus(row.pnl), D('0'))
    .toString();
}
