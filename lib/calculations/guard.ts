import Decimal from 'decimal.js';
import type { Currency, GuardSettings, LimitValue, Money, Round, Session, SessionGuardLimits } from '@/types';
import { D } from './money';
import { collectRows, dateKey } from './periods';

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
