import Decimal from 'decimal.js';
import type { Currency, DeepPartial, GuardSettings, LimitValue, Money, Round, Session, SessionGuardLimits } from '@/types';
import { D, formatMoney, parseMoneyInput } from './money';
import { collectRows, dateKey } from './periods';
import { computeTimeline, currentBalance } from './timeline';

export { chasingFlags, wouldChase } from './chasing';

export const DEFAULT_GUARD: GuardSettings = {
  sizing: { mode: 'percent', percent: '10', minBet: '0.1' },
  riskBands: { low: '5', high: '20' },
  lossStreak: { enabled: true, n: 3, mode: 'soft', cooldownMin: 5 },
  chasingAlert: true,
};

/** Suggestion only; the user's bet is never changed automatically. */
export function suggestedBet(balance: Money, sizing: GuardSettings['sizing'], precision: number): Money | null {
  if (sizing.mode === 'fixed') return null;
  const bal = D(balance);
  if (bal.lte(0)) return null;
  // ROUND_DOWN so the suggestion never exceeds the chosen percentage.
  const raw = bal.mul(sizing.percent).div(100).toDecimalPlaces(precision, Decimal.ROUND_DOWN);
  const floored = Decimal.max(sizing.minBet, raw);
  return Decimal.min(floored, bal).toString();
}

export type RiskLevel = 'low' | 'medium' | 'high';

export function riskBand(
  bet: Money,
  balance: Money,
  bands: GuardSettings['riskBands'],
): { pct: string; level: RiskLevel } | null {
  const bal = D(balance);
  if (bal.lte(0)) return null;
  const pct = D(bet).div(bal).mul(100);
  const level: RiskLevel = pct.lte(bands.low) ? 'low' : pct.lte(bands.high) ? 'medium' : 'high';
  return { pct: pct.toString(), level };
}

export function currentLossStreak(rounds: readonly Round[]): number {
  let n = 0;
  for (let i = rounds.length - 1; i >= 0 && rounds[i]!.result === 'lose'; i--) n++;
  return n;
}

export function resolveLimit(limit: LimitValue, initialBalance: Money): Money {
  return limit.kind === 'amount' ? D(limit.value).toString() : D(initialBalance).mul(limit.value).div(100).toString();
}

export type LimitHit = 'stop_loss' | 'take_profit' | 'daily_loss';

export function limitHits(input: {
  initialBalance: Money;
  balance: Money;
  limits?: SessionGuardLimits;
  todayPnl: Money;
  dailyLossLimit?: Money;
}): LimitHit[] {
  const { initialBalance, balance, limits, todayPnl, dailyLossLimit } = input;
  const hits: LimitHit[] = [];
  // A limit resolving to <= 0 is treated as "not set" so a 0 never trips instantly.
  const active = (v: Decimal) => v.gt(0);
  if (limits?.stopLoss) {
    const l = D(resolveLimit(limits.stopLoss, initialBalance));
    if (active(l) && D(initialBalance).minus(balance).gte(l)) hits.push('stop_loss');
  }
  if (limits?.takeProfit) {
    const l = D(resolveLimit(limits.takeProfit, initialBalance));
    if (active(l) && D(balance).minus(initialBalance).gte(l)) hits.push('take_profit');
  }
  if (dailyLossLimit !== undefined) {
    const l = D(dailyLossLimit);
    if (active(l) && D(todayPnl).neg().gte(l)) hits.push('daily_loss');
  }
  return hits;
}

export interface LimitHitDetail {
  hit: LimitHit;
  label: string;
  /** Signed P&L the limit is measured against (negative for losses). */
  current: Money;
  /** Resolved limit amount (always positive). */
  limit: Money;
}

const LIMIT_LABELS: Record<LimitHit, string> = {
  stop_loss: 'Stop-loss reached',
  take_profit: 'Take-profit reached',
  daily_loss: 'Daily loss limit reached',
};

/** Same rules as limitHits, plus the numbers so the confirm dialog can show why it is asking. */
export function limitHitDetails(input: Parameters<typeof limitHits>[0]): LimitHitDetail[] {
  const sessionPnl = D(input.balance).minus(input.initialBalance).toString();
  return limitHits(input).map(hit => {
    if (hit === 'daily_loss') return { hit, label: LIMIT_LABELS[hit], current: D(input.todayPnl).toString(), limit: D(input.dailyLossLimit!).toString() };
    const lv = hit === 'stop_loss' ? input.limits!.stopLoss! : input.limits!.takeProfit!;
    return { hit, label: LIMIT_LABELS[hit], current: sessionPnl, limit: resolveLimit(lv, input.initialBalance) };
  });
}

/** e.g. "Stop-loss reached: −10.00 / 10.00 USDT" (sign always shown, never colour-only). */
export function formatLimitHit(d: LimitHitDetail, precision: number, currency: Currency): string {
  return `${d.label}: ${formatMoney(d.current, { precision, signed: true })} / ${formatMoney(d.limit, { precision, currency })}`;
}

export interface LimitProgress {
  hit: LimitHit;
  label: string;
  /** Amount of the limit consumed so far, never negative (a gain does not "refund" a loss limit). */
  used: Money;
  /** Resolved limit amount (always positive). */
  limit: Money;
  reached: boolean;
}

const PROGRESS_LABELS: Record<LimitHit, string> = {
  stop_loss: 'Stop-loss',
  take_profit: 'Take-profit',
  daily_loss: 'Daily loss',
};

/** One row per limit that is set (and > 0), in a fixed order; unset limits are omitted. */
export function limitProgress(input: Parameters<typeof limitHits>[0]): LimitProgress[] {
  const { initialBalance, balance, limits, todayPnl: today, dailyLossLimit } = input;
  const rows: LimitProgress[] = [];
  const add = (hit: LimitHit, limit: Decimal, rawUsed: Decimal) => {
    if (!limit.gt(0)) return; // same "<= 0 means not set" rule as limitHits
    const used = Decimal.max(rawUsed, 0);
    rows.push({ hit, label: PROGRESS_LABELS[hit], used: used.toString(), limit: limit.toString(), reached: used.gte(limit) });
  };
  if (limits?.stopLoss) add('stop_loss', D(resolveLimit(limits.stopLoss, initialBalance)), D(initialBalance).minus(balance));
  if (limits?.takeProfit) add('take_profit', D(resolveLimit(limits.takeProfit, initialBalance)), D(balance).minus(initialBalance));
  if (dailyLossLimit !== undefined) add('daily_loss', D(dailyLossLimit), D(today).neg());
  return rows;
}

/** e.g. "Stop-loss: 6.00 / 10.00 USDT used". */
export function formatLimitProgress(p: LimitProgress, precision: number, currency: Currency): string {
  return `${p.label}: ${formatMoney(p.used, { precision })} / ${formatMoney(p.limit, { precision, currency })} used`;
}

/** Progress for the active session from raw state (display only; recording re-checks via evaluateSessionLimits). */
export function evaluateSessionProgress(input: {
  session: Session;
  sessions: readonly Session[];
  dailyLossLimit?: Money;
  now: Date;
  tz?: string;
}): LimitProgress[] {
  const { session, sessions, dailyLossLimit, now, tz } = input;
  const balance = currentBalance(session.initialBalance, computeTimeline(session.initialBalance, session.rounds));
  return limitProgress({
    initialBalance: session.initialBalance,
    balance,
    limits: session.guard,
    todayPnl: todayPnl(sessions, session.currency, now, tz),
    dailyLossLimit,
  });
}

/**
 * Limits for one session evaluated from raw state, so callers can check at click time
 * (fresh store snapshot) rather than trusting values captured at the last render.
 */
export function evaluateSessionLimits(input: {
  session: Session;
  sessions: readonly Session[];
  dailyLossLimit?: Money;
  now: Date;
  tz?: string;
}): LimitHitDetail[] {
  const { session, sessions, dailyLossLimit, now, tz } = input;
  const balance = currentBalance(session.initialBalance, computeTimeline(session.initialBalance, session.rounds));
  return limitHitDetails({
    initialBalance: session.initialBalance,
    balance,
    limits: session.guard,
    // Daily limit spans every session of this currency only (currencies never mix).
    todayPnl: todayPnl(sessions, session.currency, now, tz),
    dailyLossLimit,
  });
}

/** Is the typed bet the same amount as `value`? Invalid input counts as different (so a suggestion still shows). */
export function isSameAmount(value: Money, input: string): boolean {
  const p = parseMoneyInput(input);
  return p.ok && D(p.value).eq(value);
}

/** Net P&L of today's (Bangkok) rounds across all sessions of one currency. */
export function todayPnl(sessions: readonly Session[], currency: Currency, now: Date, tz?: string): Money {
  const today = dateKey(now.toISOString(), tz);
  return collectRows(sessions, { currency })
    .filter(r => dateKey(r.round.createdAt, tz) === today)
    .reduce((acc, r) => acc.plus(r.pnl), D('0'))
    .toString();
}

/** 'mm:ss' countdown; ceil to whole seconds so it never shows 00:00 while time remains. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export type GuardErrors = Record<string, string>;
export type GuardValidation = { ok: true; value: GuardSettings } | { ok: false; errors: GuardErrors };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Plain decimal string (via parseMoneyInput) -> normalised string, else null. Non-strings are rejected. */
function decimal(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const p = parseMoneyInput(v);
  return p.ok ? p.value : null;
}

const inRangeInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Shared by stop-loss / take-profit in the store, the session form and the backup schema. */
export function validateLimitValue(raw: unknown): LimitValue | null {
  if (!isRecord(raw) || (raw.kind !== 'amount' && raw.kind !== 'percent')) return null;
  const value = decimal(raw.value);
  if (value === null || !D(value).gt(0)) return null;
  if (raw.kind === 'percent' && D(value).gt(100)) return null;
  return { kind: raw.kind, value };
}

/**
 * Pure validation of a settings patch against the current guard. Nested objects merge key by key;
 * `dailyLossLimit: undefined` clears it. Nothing is applied unless the merged result is fully valid.
 */
export function validateGuardPatch(current: GuardSettings, patch: DeepPartial<GuardSettings>): GuardValidation {
  const p = (isRecord(patch) ? patch : {}) as Record<string, Record<string, unknown> | unknown>;
  const sub = (k: string): Record<string, unknown> => (isRecord(p[k]) ? (p[k] as Record<string, unknown>) : {});
  const sizing: Record<string, unknown> = { ...current.sizing, ...sub('sizing') };
  const bands: Record<string, unknown> = { ...current.riskBands, ...sub('riskBands') };
  const streak: Record<string, unknown> = { ...current.lossStreak, ...sub('lossStreak') };
  const chasing = 'chasingAlert' in p ? p.chasingAlert : current.chasingAlert;
  const dailyRaw = 'dailyLossLimit' in p ? p.dailyLossLimit : current.dailyLossLimit;

  const errors: GuardErrors = {};
  if (sizing.mode !== 'fixed' && sizing.mode !== 'percent') errors['sizing.mode'] = 'Choose a sizing mode';
  const percent = decimal(sizing.percent);
  if (percent === null || !D(percent).gt(0) || D(percent).gt(100)) errors['sizing.percent'] = 'Enter a percent above 0 and up to 100';
  const minBet = decimal(sizing.minBet);
  if (minBet === null || !D(minBet).gt(0)) errors['sizing.minBet'] = 'Enter a minimum bet greater than 0';

  const low = decimal(bands.low);
  const high = decimal(bands.high);
  const bandOk = (v: string | null) => v !== null && D(v).gte(0) && D(v).lte(100);
  if (!bandOk(low)) errors['riskBands.low'] = 'Enter a percent from 0 to 100';
  if (!bandOk(high)) errors['riskBands.high'] = 'Enter a percent from 0 to 100';
  if (bandOk(low) && bandOk(high) && !D(low!).lt(high!)) errors['riskBands.high'] = 'High must be greater than low';

  if (typeof streak.enabled !== 'boolean') errors['lossStreak.enabled'] = 'Invalid value';
  if (!inRangeInt(streak.n, 2, 20)) errors['lossStreak.n'] = 'Enter a whole number from 2 to 20';
  if (streak.mode !== 'soft' && streak.mode !== 'hard') errors['lossStreak.mode'] = 'Choose a mode';
  if (!inRangeInt(streak.cooldownMin, 1, 120)) errors['lossStreak.cooldownMin'] = 'Enter whole minutes from 1 to 120';
  if (typeof chasing !== 'boolean') errors.chasingAlert = 'Invalid value';

  let daily: string | undefined;
  if (dailyRaw !== undefined) {
    const d = decimal(dailyRaw);
    if (d === null || !D(d).gt(0)) errors.dailyLossLimit = 'Enter an amount greater than 0, or leave empty';
    else daily = d;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const value: GuardSettings = {
    sizing: { mode: sizing.mode as 'fixed' | 'percent', percent: percent!, minBet: minBet! },
    riskBands: { low: low!, high: high! },
    lossStreak: {
      enabled: streak.enabled as boolean,
      n: streak.n as number,
      mode: streak.mode as 'soft' | 'hard',
      cooldownMin: streak.cooldownMin as number,
    },
    chasingAlert: chasing as boolean,
    ...(daily !== undefined ? { dailyLossLimit: daily } : {}),
  };
  return { ok: true, value };
}

/** Complete, valid guard settings from untrusted input, or null (every section must be present). */
export function parseGuardSettings(raw: unknown): GuardSettings | null {
  if (!isRecord(raw) || !isRecord(raw.sizing) || !isRecord(raw.riskBands) || !isRecord(raw.lossStreak)) return null;
  const r = validateGuardPatch(DEFAULT_GUARD, raw as DeepPartial<GuardSettings>);
  // Reject sections that only passed because defaults filled gaps.
  const complete =
    ['mode', 'percent', 'minBet'].every(k => k in (raw.sizing as object)) &&
    ['low', 'high'].every(k => k in (raw.riskBands as object)) &&
    ['enabled', 'n', 'mode', 'cooldownMin'].every(k => k in (raw.lossStreak as object)) &&
    'chasingAlert' in raw;
  return r.ok && complete ? r.value : null;
}

/** Lenient read: anything unusable becomes the defaults (guard problems must never block the app). */
export function sanitizeGuard(raw: unknown): GuardSettings {
  return parseGuardSettings(raw) ?? DEFAULT_GUARD;
}
