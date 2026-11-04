import type { Money, Round } from '@/types';
import { D } from './money';

export interface TimelineRow {
  round: Round;
  index: number; // 1-based
  balanceBefore: Money;
  payout: Money;
  pnl: Money;
  balanceAfter: Money;
  insufficient: boolean;
}

/**
 * Single source of truth for every balance in the app: walks rounds in array order.
 * Nothing is stored, so editing or deleting an old round simply recomputes the rest.
 * Values stay full-precision strings; rounding happens only at display time.
 */
export function computeTimeline(initialBalance: Money, rounds: readonly Round[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let balance = D(initialBalance);
  rounds.forEach((round, i) => {
    const bet = D(round.bet);
    const payout = round.result === 'win' ? bet.mul(D(round.multiplier)) : D('0');
    const pnl = round.result === 'win' ? payout.minus(bet) : bet.neg();
    const balanceAfter = balance.plus(pnl);
    rows.push({
      round,
      index: i + 1,
      balanceBefore: balance.toString(),
      payout: payout.toString(),
      pnl: pnl.toString(),
      balanceAfter: balanceAfter.toString(),
      // Kept (not dropped) so the UI can warn about it after an old round is edited.
      insufficient: bet.gt(balance),
    });
    balance = balanceAfter;
  });
  return rows;
}

export function currentBalance(initialBalance: Money, timeline: readonly TimelineRow[]): Money {
  const last = timeline[timeline.length - 1];
  return last ? last.balanceAfter : initialBalance;
}
