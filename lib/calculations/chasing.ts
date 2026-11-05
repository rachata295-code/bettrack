import type { Money, Round } from '@/types';
import { D } from './money';

// Lives apart from guard.ts so periods.ts can use it without an import cycle (guard.ts imports periods.ts).
// guard.ts re-exports both functions.

/** [i] = previous round lost and this round's bet is larger. First round is never chasing. */
export function chasingFlags(rounds: readonly Round[]): boolean[] {
  return rounds.map((r, i) => {
    const prev = rounds[i - 1];
    return prev !== undefined && prev.result === 'lose' && D(r.bet).gt(prev.bet);
  });
}

/** Would recording `nextBet` now count as chasing? Used to warn before/after saving. */
export function wouldChase(rounds: readonly Round[], nextBet: Money): boolean {
  const last = rounds[rounds.length - 1];
  return last !== undefined && last.result === 'lose' && D(nextBet).gt(last.bet);
}
