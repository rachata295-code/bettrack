// Money and multipliers are decimal strings, never numbers, to avoid float error.
export type Money = string;

export type Currency = 'USDT' | 'THB' | 'USD';
export const CURRENCIES: readonly Currency[] = ['USDT', 'THB', 'USD'];

export type RoundResult = 'win' | 'lose';

export interface Round {
  id: string; // newId() (RFC 4122 v4)
  result: RoundResult;
  bet: Money;
  multiplier: string; // > 1
  createdAt: string; // ISO 8601 (UTC)
  note?: string;
}

// `guard` (stop-loss / take-profit) is added in M2.
export interface Session {
  id: string;
  name: string;
  currency: Currency;
  initialBalance: Money;
  defaultBet: Money;
  defaultMultiplier: string;
  rounds: Round[]; // array order = chronological order
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// M1 settings only; the rest arrive in later milestones.
export interface Settings {
  precision: number; // 0-8, default 2
}
