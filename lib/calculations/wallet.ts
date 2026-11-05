import { CURRENCIES } from '@/types';
import type { Currency, FxRates, Money, Session, Transaction } from '@/types';
import { convert } from './fx';
import { D, isPositive, parseMoneyInput } from './money';
import { computeTimeline, currentBalance } from './timeline';

export const MAX_NOTE_LEN = 200;
// Same strict ISO shape as backup import: lenient strings would break period bucketing.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

type Errors = Record<string, string>;

export function validateTransaction(
  input: unknown,
): { ok: true; value: Omit<Transaction, 'id'> } | { ok: false; errors: Errors } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _: 'Invalid transaction' } };
  }
  const r = input as Record<string, unknown>;
  const errors: Errors = {};

  const type = r.type === 'deposit' || r.type === 'withdraw' ? r.type : null;
  if (!type) errors.type = 'Choose deposit or withdraw';

  const amountP = typeof r.amount === 'string' ? parseMoneyInput(r.amount) : { ok: false as const };
  if (!amountP.ok || !isPositive(amountP.value)) errors.amount = 'Enter an amount greater than 0';

  // Fee defaults to 0 when left out or empty.
  const feeRaw = r.fee === undefined || (typeof r.fee === 'string' && r.fee.trim() === '') ? '0' : r.fee;
  const feeP = typeof feeRaw === 'string' ? parseMoneyInput(feeRaw) : { ok: false as const };
  if (!feeP.ok) errors.fee = 'Enter a fee of 0 or more';

  const currency = CURRENCIES.find(c => c === r.currency);
  if (!currency) errors.currency = 'Choose a currency';

  const at = typeof r.at === 'string' && ISO_RE.test(r.at) && !Number.isNaN(Date.parse(r.at)) ? r.at : null;
  if (!at) errors.at = 'Enter a valid date and time';

  let note: string | undefined;
  if (r.note !== undefined) {
    if (typeof r.note !== 'string') errors.note = 'Invalid note';
    else {
      const t = r.note.trim();
      if (t.length > MAX_NOTE_LEN) errors.note = `Note must be ${MAX_NOTE_LEN} characters or fewer`;
      else if (t) note = t;
    }
  }

  if (Object.keys(errors).length > 0 || !type || !amountP.ok || !feeP.ok || !currency || !at) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { type, amount: amountP.value, currency, fee: feeP.value, at, ...(note !== undefined ? { note } : {}) },
  };
}

const sortedUnique = (list: Currency[]): Currency[] => [...new Set(list)].sort();

/** Sum of every session's current balance, converted to `currency`. */
export function onPlatformBalance(
  sessions: readonly Session[],
  currency: Currency,
  fx: FxRates,
): { value: Money } | { missingRates: Currency[] } {
  let total = D('0');
  const missing: Currency[] = [];
  for (const s of sessions) {
    const bal = currentBalance(s.initialBalance, computeTimeline(s.initialBalance, s.rounds));
    const c = convert(bal, s.currency, currency, fx);
    if (c === null) missing.push(s.currency);
    else total = total.plus(c);
  }
  return missing.length > 0 ? { missingRates: sortedUnique(missing) } : { value: total.toString() };
}

export interface RealPnl {
  deposits: Money;
  withdrawals: Money;
  fees: Money;
  onPlatform: Money;
  net: Money;
}

/** net = withdrawals − deposits − fees + onPlatform, all converted to `currency` first (unrounded). */
export function realPnl(input: {
  transactions: readonly Transaction[];
  onPlatform: Money;
  currency: Currency;
  fx: FxRates;
}): RealPnl | { missingRates: Currency[] } {
  const { transactions, onPlatform, currency, fx } = input;
  let deposits = D('0');
  let withdrawals = D('0');
  let fees = D('0');
  const missing: Currency[] = [];
  for (const t of transactions) {
    const amount = convert(t.amount, t.currency, currency, fx);
    const fee = convert(t.fee, t.currency, currency, fx);
    if (amount === null || fee === null) {
      missing.push(t.currency);
      continue;
    }
    if (t.type === 'deposit') deposits = deposits.plus(amount);
    else withdrawals = withdrawals.plus(amount);
    fees = fees.plus(fee);
  }
  if (missing.length > 0) return { missingRates: sortedUnique(missing) };
  const net = withdrawals.minus(deposits).minus(fees).plus(onPlatform);
  return {
    deposits: deposits.toString(),
    withdrawals: withdrawals.toString(),
    fees: fees.toString(),
    onPlatform: D(onPlatform).toString(),
    net: net.toString(),
  };
}
