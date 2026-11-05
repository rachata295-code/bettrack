import type { Money } from '@/types';
import { D } from './money';
import type { TimelineRow } from './timeline';

// All percent fields are plain decimal strings, unrounded; rounding happens at display (formatPercent).
export interface SessionStats {
  current: Money;
  initial: Money;
  netPnl: Money;
  roiPct: string;
  highest: Money;
  lowest: Money;
  rounds: number;
  wins: number;
  losses: number;
  winRatePct: string;
  wagered: Money;
  payouts: Money;
  avgPnl: Money;
  largestWin: Money;
  largestLoss: Money; // positive magnitude
  streak: { type: 'win' | 'lose' | null; count: number };
  maxDrawdown: Money;
  maxDrawdownPct: string;
}

export function computeSessionStats(initialBalance: Money, timeline: readonly TimelineRow[]): SessionStats {
  const initial = D(initialBalance);
  const n = timeline.length;
  const last = timeline[n - 1];
  const current = last ? D(last.balanceAfter) : initial;
  const netPnl = current.minus(initial);

  let wins = 0;
  let wagered = D('0');
  let payouts = D('0');
  let largestWin = D('0');
  let largestLoss = D('0');
  let highest = initial;
  let lowest = initial;
  // Drawdown walks [initial, ...balanceAfter]: biggest drop from a running peak.
  let peak = initial;
  let maxDd = D('0');
  let maxDdPct = D('0');

  for (const row of timeline) {
    const pnl = D(row.pnl);
    const bal = D(row.balanceAfter);
    wagered = wagered.plus(row.round.bet);
    payouts = payouts.plus(row.payout);
    if (row.round.result === 'win') {
      wins++;
      if (pnl.gt(largestWin)) largestWin = pnl;
    } else if (pnl.neg().gt(largestLoss)) {
      largestLoss = pnl.neg();
    }
    if (bal.gt(highest)) highest = bal;
    if (bal.lt(lowest)) lowest = bal;
    if (bal.gt(peak)) peak = bal;
    const dd = peak.minus(bal);
    if (dd.gt(maxDd)) {
      maxDd = dd;
      // Guard: a non-positive peak would divide by zero or flip the sign.
      maxDdPct = peak.gt(0) ? dd.div(peak).mul(100) : D('0');
    }
  }

  // Streak = run length of the most recent result.
  let streak: SessionStats['streak'] = { type: null, count: 0 };
  if (last) {
    const type = last.round.result;
    let count = 0;
    for (let i = n - 1; i >= 0 && timeline[i]!.round.result === type; i--) count++;
    streak = { type, count };
  }

  return {
    current: current.toString(),
    initial: initial.toString(),
    netPnl: netPnl.toString(),
    roiPct: initial.gt(0) ? netPnl.div(initial).mul(100).toString() : '0',
    highest: highest.toString(),
    lowest: lowest.toString(),
    rounds: n,
    wins,
    losses: n - wins,
    winRatePct: n > 0 ? D(String(wins)).div(n).mul(100).toString() : '0',
    wagered: wagered.toString(),
    payouts: payouts.toString(),
    avgPnl: n > 0 ? netPnl.div(n).toString() : '0',
    largestWin: largestWin.toString(),
    largestLoss: largestLoss.toString(),
    streak,
    maxDrawdown: maxDd.toString(),
    maxDrawdownPct: maxDdPct.toString(),
  };
}
