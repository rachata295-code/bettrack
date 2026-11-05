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

export interface Session {
  id: string;
  name: string;
  currency: Currency;
  initialBalance: Money;
  defaultBet: Money;
  defaultMultiplier: string;
  rounds: Round[]; // array order = chronological order
  tags: string[];
  guard?: SessionGuardLimits; // stop-loss / take-profit per session
  createdAt: string;
  updatedAt: string;
}

// Backup shape of persisted settings; guard is optional so M1 backups still parse.
export interface Settings {
  precision: number; // 0-8, default 2
  guard?: GuardSettings;
  fx?: FxRates;
  fees?: FeeSettings;
  realityCheck?: RealityCheckSettings;
}

// Manual exchange rates (THB per 1 unit); entered by the user, never fetched.
export type FxRates = { usdtThb?: Money; usdThb?: Money };

export type FeeSettings = {
  cryptoWithdrawFee: Money; // in the withdrawn currency
  tradeFeePct: string; // exchange trading fee, 0 <= x < 100
  spreadPct: string; // 0 <= x < 100
  thbWithdrawFee: Money; // in THB
};

export type RealityCheckSettings = { enabled: boolean; intervalMin: number };

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export type LimitValue = { kind: 'amount' | 'percent'; value: string };
export interface SessionGuardLimits {
  stopLoss?: LimitValue;
  takeProfit?: LimitValue;
}

export interface GuardSettings {
  sizing: { mode: 'fixed' | 'percent'; percent: string; minBet: string };
  riskBands: { low: string; high: string }; // % of balance
  lossStreak: { enabled: boolean; n: number; mode: 'soft' | 'hard'; cooldownMin: number };
  dailyLossLimit?: Money; // all sessions of one currency, Bangkok day
  chasingAlert: boolean;
}
