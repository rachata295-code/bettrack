import { describe, expect, it } from 'vitest';
import { mulberry32, simulate, validateSimInput } from '@/lib/calculations/montecarlo';

const base = {
  multiplier: 2,
  start: 10,
  bet: { mode: 'fixed', amount: 4 },
  rounds: 5,
  runs: 100,
  seed: 1,
  precision: 2,
} as const;

const okRaw = {
  p: '48.77',
  multiplier: '2.03',
  start: '16.99',
  betMode: 'fixed',
  bet: '4',
  rounds: '100',
  runs: '100',
  seed: '1',
};

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const c = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = c();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('simulate', () => {
  it('always wins at p=1', () => {
    expect(simulate({ ...base, p: 1 })).toMatchObject({ ruinProb: 0, medianFinal: 30, probAboveStart: 1 });
  });
  it('always loses at p=0 and ruins', () => {
    expect(simulate({ ...base, p: 0 })).toMatchObject({ ruinProb: 1, medianFinal: 2, probAboveStart: 0 });
  });
  it('round 0 band equals start', () => {
    expect(simulate({ ...base, p: 0.5, runs: 2000 })!.bands[0]).toEqual({ round: 0, p10: 10, p50: 10, p90: 10 });
  });
  it('is reproducible for the same seed', () => {
    expect(simulate({ ...base, p: 0.5 })).toEqual(simulate({ ...base, p: 0.5 }));
  });
  it('returns null when stopped', () => {
    expect(simulate({ ...base, p: 0.5 }, { shouldStop: () => true })).toBeNull();
  });
  it('caps band points and ends at the last round', () => {
    const r = simulate({ ...base, p: 0.5, rounds: 1000, runs: 50 })!;
    expect(r.bands.length).toBe(201);
    expect(r.bands[0]!.round).toBe(0);
    expect(r.bands[200]!.round).toBe(1000);
  });
  it('percent mode never bets below minBet and freezes when balance < minBet', () => {
    const r = simulate({
      ...base,
      p: 0,
      bet: { mode: 'percent', percent: 50, minBet: 1 },
      rounds: 20,
    })!;
    expect(r.ruinProb).toBe(1);
    expect(r.medianFinal).toBeLessThan(1);
  });
  it('reports progress at least once, ending at runs', () => {
    const seen: number[] = [];
    simulate({ ...base, p: 0.5, runs: 500 }, { onProgress: (d) => seen.push(d) });
    expect(seen.at(-1)).toBe(500);
  });
  it.skipIf(!process.env.BENCH)('bench 10k x 10k < 15s', () => {
    const t = performance.now();
    simulate({ ...base, p: 0.49, rounds: 10000, runs: 10000 });
    const ms = performance.now() - t;
    console.log(`bench 10k x 10k: ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(15000);
  }, 60000);
});

describe('validateSimInput', () => {
  it('accepts valid input and defaults precision to 2', () => {
    const r = validateSimInput(okRaw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.p).toBeCloseTo(0.4877);
      expect(r.value.precision).toBe(2);
      expect(r.value.bet).toEqual({ mode: 'fixed', amount: 4 });
    }
  });
  it('rejects rounds over 10000', () => {
    const r = validateSimInput({ ...okRaw, rounds: '10001' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.rounds).toBeTruthy();
  });
  it('rejects bad fields keyed by name', () => {
    const r = validateSimInput({ ...okRaw, p: '100', multiplier: '1', start: '0', runs: '0', seed: '-1', precision: '9' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['multiplier', 'p', 'precision', 'runs', 'seed', 'start']);
  });
  it('validates percent mode', () => {
    expect(validateSimInput({ ...okRaw, betMode: 'percent', percent: '10', minBet: '0.1' }).ok).toBe(true);
    const r = validateSimInput({ ...okRaw, betMode: 'percent', percent: '101', minBet: '0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['minBet', 'percent']);
  });
  it('rejects seed above 2^32-1', () => {
    expect(validateSimInput({ ...okRaw, seed: '4294967296' }).ok).toBe(false);
    expect(validateSimInput({ ...okRaw, seed: '4294967295' }).ok).toBe(true);
  });
});
