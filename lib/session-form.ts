import { CURRENCIES, type Currency, type LimitValue, type Money, type SessionGuardLimits } from '@/types';
import { validateLimitValue } from '@/lib/calculations/guard';
import { D, parseMoneyInput } from '@/lib/calculations/money';

export const MAX_NAME = 60;
export const MAX_TAGS = 10;

export interface SessionFormInput {
  name: string;
  currency: Currency;
  initialBalance: string;
  defaultBet: string;
  defaultMultiplier: string;
  /** Comma-separated. */
  tags: string;
  /** Empty value = limit off. */
  stopLossValue: string;
  stopLossKind: LimitValue['kind'];
  takeProfitValue: string;
  takeProfitKind: LimitValue['kind'];
}

export interface SessionFormValue {
  name: string;
  currency: Currency;
  initialBalance: Money;
  defaultBet: Money;
  defaultMultiplier: Money;
  tags: string[];
  /** null = no limits (also removes existing ones on edit). */
  guard: SessionGuardLimits | null;
}

export type SessionFormField = keyof SessionFormInput;

export type SessionFormResult =
  | { ok: true; value: SessionFormValue }
  | { ok: false; errors: Partial<Record<SessionFormField, string>> };

/** Mirrors the store's normalizeSessionPatch, which silently falls back to defaults, so the form must reject first. */
export function validateSessionForm(input: SessionFormInput): SessionFormResult {
  const errors: Partial<Record<SessionFormField, string>> = {};

  const name = input.name.trim();
  if (name.length < 1 || name.length > MAX_NAME) errors.name = `Name must be 1–${MAX_NAME} characters`;

  if (!CURRENCIES.includes(input.currency)) errors.currency = 'Choose a currency';

  const bal = parseMoneyInput(input.initialBalance);
  if (!bal.ok) errors.initialBalance = 'Enter a number, 0 or more';

  const bet = parseMoneyInput(input.defaultBet);
  if (!bet.ok || !D(bet.value).gt(0)) errors.defaultBet = 'Enter a bet greater than 0';

  const mult = parseMoneyInput(input.defaultMultiplier);
  if (!mult.ok || !D(mult.value).gt(1)) errors.defaultMultiplier = 'Multiplier must be greater than 1';

  const tags = [...new Set(input.tags.split(',').map(t => t.trim()).filter(Boolean))];
  if (tags.length > MAX_TAGS) errors.tags = `At most ${MAX_TAGS} tags`;

  const guard: SessionGuardLimits = {};
  const limit = (key: 'stopLoss' | 'takeProfit', raw: string, kind: LimitValue['kind'], field: SessionFormField) => {
    const text = raw.trim();
    if (!text) return;
    const v = validateLimitValue({ kind, value: text });
    if (v) guard[key] = v;
    else errors[field] = kind === 'percent' ? 'Enter a percent above 0 and up to 100' : 'Enter an amount greater than 0';
  };
  limit('stopLoss', input.stopLossValue, input.stopLossKind, 'stopLossValue');
  limit('takeProfit', input.takeProfitValue, input.takeProfitKind, 'takeProfitValue');

  if (Object.keys(errors).length > 0 || !bal.ok || !bet.ok || !mult.ok) return { ok: false, errors };
  return {
    ok: true,
    value: { name, currency: input.currency, initialBalance: bal.value, defaultBet: bet.value, defaultMultiplier: mult.value, tags,
      guard: guard.stopLoss || guard.takeProfit ? guard : null,
    },
  };
}
