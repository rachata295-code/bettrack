// Monte Carlo engine. The ONE place in lib/ allowed to use float `number` for money:
// 10^8 Decimal operations are too slow, and the result is a statistical estimate anyway.
// Inputs come from validated decimal strings; callers must format outputs via formatMoney.
import { parseMoneyInput } from './money';
import { parseProbability } from './risk';

export type SimBet =
  | { mode: 'fixed'; amount: number }
  | { mode: 'percent'; percent: number; minBet: number };

export interface SimInput {
  p: number;
  multiplier: number;
  start: number;
  bet: SimBet;
  rounds: number;
  runs: number;
  seed: number;
  precision: number;
}

export interface SimBand {
  round: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimResult {
  ruinProb: number;
  medianFinal: number;
  probAboveStart: number;
  meanFinal: number;
  bands: SimBand[];
}

/** Small seeded PRNG returning floats in [0,1); same seed gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_POINTS = 200;
const PROGRESS_STEP = 0.02;

/** Nearest-rank on a sorted array: index = floor(q * (n - 1)). */
function quantile(sorted: Float64Array, q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
}

export function simulate(
  input: SimInput,
  hooks?: { onProgress?: (done: number) => void; shouldStop?: () => boolean },
): SimResult | null {
  const { p, multiplier, start, bet, rounds, runs, seed, precision } = input;
  const scale = 10 ** precision;
  const round = (x: number) => Math.round(x * scale) / scale;
  const startR = round(start);
  const profitMult = multiplier - 1;

  // Bet for the next round; Infinity means it cannot be played (below minBet in percent mode).
  // Percent floor works on integer units (round first) so float error like 1.15*100 = 114.99999 cannot undershoot.
  const nextBet = (balance: number): number => {
    if (bet.mode === 'fixed') return bet.amount;
    if (balance < bet.minBet) return Infinity;
    const units = Math.floor((Math.round(balance * scale) * bet.percent) / 100 + 1e-9) / scale;
    return Math.max(bet.minBet, units);
  };

  // Snapshot rounds: 0 and evenly spaced up to `rounds` (strictly increasing since rounds/k >= 1).
  const k = Math.min(rounds, MAX_POINTS);
  const points = k + 1;
  const snapRounds = new Int32Array(points);
  for (let i = 0; i < points; i++) snapRounds[i] = Math.round((i * rounds) / k);

  // Only balances at snapshot rounds are stored: runs x points floats.
  const snaps = new Float64Array(runs * points);
  const rand = mulberry32(seed);
  const step = Math.max(1, Math.floor(runs * PROGRESS_STEP));
  let ruined = 0;

  for (let run = 0; run < runs; run++) {
    let balance = startR;
    let dead = false;
    let next = 1; // next snapshot index to fill (index 0 is round 0)
    const base = run * points;
    snaps[base] = balance;
    for (let r = 1; r <= rounds; r++) {
      if (!dead) {
        const amount = nextBet(balance);
        if (amount > balance) {
          dead = true;
          ruined++;
        } else {
          balance = round(rand() < p ? balance + amount * profitMult : balance - amount);
        }
      }
      if (r === snapRounds[next]) snaps[base + next++] = balance;
    }
    // A run that cannot afford the next bet after the final round also counts as ruined (PLAN §5).
    if (!dead && nextBet(balance) > balance) ruined++;
    if ((run + 1) % step === 0 || run + 1 === runs) {
      hooks?.onProgress?.(run + 1);
      if (run + 1 < runs && hooks?.shouldStop?.()) return null;
    }
  }

  const bands: SimBand[] = [];
  const col = new Float64Array(runs);
  let finals = new Float64Array(0);
  for (let i = 0; i < points; i++) {
    for (let run = 0; run < runs; run++) col[run] = snaps[run * points + i] as number;
    col.sort();
    bands.push({
      round: snapRounds[i] as number,
      p10: quantile(col, 0.1),
      p50: quantile(col, 0.5),
      p90: quantile(col, 0.9),
    });
    if (i === points - 1) finals = col;
  }

  let above = 0;
  let sum = 0;
  for (let run = 0; run < runs; run++) {
    const v = finals[run] as number;
    if (v > startR) above++;
    sum += v;
  }
  return {
    ruinProb: ruined / runs,
    medianFinal: quantile(finals, 0.5),
    probAboveStart: above / runs,
    meanFinal: sum / runs,
    bands,
  };
}

function parseNum(raw: string | undefined): number | null {
  const m = parseMoneyInput(raw ?? '');
  return m.ok ? Number(m.value) : null;
}

function parseInt01(raw: string | undefined, min: number, max: number): number | null {
  const s = (raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

export function validateSimInput(
  raw: Record<string, string>,
): { ok: true; value: SimInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const pp = parseProbability(raw.p ?? '');
  if (!pp.ok) errors.p = 'Enter a win probability between 0 and 100 (exclusive)';

  const multiplier = parseNum(raw.multiplier);
  if (multiplier === null || multiplier <= 1) errors.multiplier = 'Multiplier must be greater than 1';

  const start = parseNum(raw.start);
  if (start === null || start <= 0) errors.start = 'Starting balance must be greater than 0';

  let bet: SimBet | null = null;
  if (raw.betMode === 'fixed') {
    const amount = parseNum(raw.bet);
    if (amount === null || amount <= 0) errors.bet = 'Bet must be greater than 0';
    else bet = { mode: 'fixed', amount };
  } else if (raw.betMode === 'percent') {
    const percent = parseNum(raw.percent);
    const minBet = parseNum(raw.minBet);
    if (percent === null || percent <= 0 || percent > 100) errors.percent = 'Percent must be between 0 and 100';
    if (minBet === null || minBet <= 0) errors.minBet = 'Minimum bet must be greater than 0';
    if (percent !== null && minBet !== null && !errors.percent && !errors.minBet) {
      bet = { mode: 'percent', percent, minBet };
    }
  } else {
    errors.betMode = 'Choose fixed or percent';
  }

  const rounds = parseInt01(raw.rounds, 1, 10000);
  if (rounds === null) errors.rounds = 'Rounds must be a whole number from 1 to 10,000';
  const runs = parseInt01(raw.runs, 1, 10000);
  if (runs === null) errors.runs = 'Runs must be a whole number from 1 to 10,000';
  const seed = parseInt01(raw.seed, 0, 4294967295);
  if (seed === null) errors.seed = 'Seed must be a whole number from 0 to 4,294,967,295';
  const precisionRaw = (raw.precision ?? '').trim();
  const precision = precisionRaw === '' ? 2 : parseInt01(precisionRaw, 0, 8);
  if (precision === null) errors.precision = 'Precision must be a whole number from 0 to 8';

  if (
    Object.keys(errors).length > 0 ||
    !pp.ok ||
    multiplier === null ||
    start === null ||
    bet === null ||
    rounds === null ||
    runs === null ||
    seed === null ||
    precision === null
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { p: Number(pp.value), multiplier, start, bet, rounds, runs, seed, precision },
  };
}
