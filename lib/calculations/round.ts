import type { Money } from '@/types';
import { D, parseMoneyInput } from './money';

export type BetInputError = 'invalid_bet' | 'invalid_multiplier' | 'insufficient_balance' | 'no_balance';

export const BET_ERROR_MESSAGES: Record<BetInputError, string> = {
  invalid_bet: 'Enter a bet greater than 0.',
  invalid_multiplier: 'Multiplier must be greater than 1.',
  insufficient_balance: 'Bet is more than your balance.',
  no_balance: 'No balance left to bet.',
};

export function validateBetInput(input: {
  balance: Money;
  bet: string;
  multiplier: string;
}): { ok: true; bet: Money; multiplier: string } | { ok: false; errors: BetInputError[] } {
  const errors: BetInputError[] = [];
  const bet = parseMoneyInput(input.bet);
  const mult = parseMoneyInput(input.multiplier);
  const betValid = bet.ok && D(bet.value).gt(0);
  const multValid = mult.ok && D(mult.value).gt(1);
  const balance = D(input.balance);

  if (!betValid) errors.push('invalid_bet');
  if (!multValid) errors.push('invalid_multiplier');
  if (balance.lte(0)) errors.push('no_balance');
  // Only compare against balance when it is meaningful: valid bet, and not already "no balance".
  else if (bet.ok && betValid && D(bet.value).gt(balance)) errors.push('insufficient_balance');

  if (errors.length > 0 || !bet.ok || !mult.ok) return { ok: false, errors };
  return { ok: true, bet: bet.value, multiplier: mult.value };
}

export function previewRound(
  balance: Money,
  bet: Money,
  multiplier: string,
): {
  win: { payout: Money; profit: Money; newBalance: Money };
  lose: { loss: Money; newBalance: Money };
} {
  const b = D(balance);
  const stake = D(bet);
  const payout = stake.mul(D(multiplier));
  const profit = payout.minus(stake);
  return {
    win: { payout: payout.toString(), profit: profit.toString(), newBalance: b.plus(profit).toString() },
    lose: { loss: stake.toString(), newBalance: b.minus(stake).toString() },
  };
}
