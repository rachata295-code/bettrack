import Decimal from 'decimal.js';
import type { Money } from '@/types';
import { D, parseMoneyInput } from './money';

/** Math break-even point 1/m as a percent (unrounded). Not the game's real win chance. */
export function breakEvenWinRate(multiplier: string): string {
  return D('1').div(multiplier).mul(100).toString();
}

/** Accepts a percent string ("48.77") and returns a probability string; requires 0 < p < 1. */
export function parseProbability(raw: string): { ok: true; value: string } | { ok: false } {
  const parsed = parseMoneyInput(raw);
  if (!parsed.ok) return { ok: false };
  const p = D(parsed.value).div(100);
  if (p.lte(0) || p.gte(1)) return { ok: false };
  return { ok: true, value: p.toString() };
}

export function evPerRound(bet: Money, p: string, multiplier: string): Money {
  return D(bet).mul(D(p).mul(multiplier).minus(1)).toString();
}

export function probAtLeastOneWin(p: string, k: number): string {
  if (!Number.isInteger(k) || k < 1) return '0';
  return D('1').minus(D('1').minus(p).pow(k)).toString();
}

/** Rounds of winning needed to recover `loss`; null when there is nothing to recover or no profit per win. */
export function breakEvenRounds(loss: Money, bet: Money, multiplier: string): number | null {
  const l = D(loss);
  const m = D(multiplier);
  const b = D(bet);
  if (l.lte(0) || m.lte(1) || b.lte(0)) return null;
  return l.div(b.mul(m.minus(1))).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
}

/**
 * Win-probability percent at which EV is `-edgePct`% of the bet: (1 - edge)/m * 100, 2 dp.
 * Used to pre-fill an illustrative example; null when the multiplier is not a positive number.
 */
export function houseEdgeExampleP(multiplier: string, edgePct = '1'): string | null {
  const parsed = parseMoneyInput(multiplier);
  if (!parsed.ok || D(parsed.value).lte(0)) return null;
  return D('1').minus(D(edgePct).div(100)).div(parsed.value).mul(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();
}

/** Amount below the starting balance (0 when at or above it) — the default break-even target. */
export function currentLoss(initialBalance: Money, balance: Money): Money {
  const loss = D(initialBalance).minus(balance);
  return loss.isNegative() ? '0' : loss.toString();
}
