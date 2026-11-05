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
  it('percent bet floors on integer units (no float undershoot)', () => {
    const pct = { mode: 'percent', percent: 100, minBet: 0.01 } as const;
    expect(simulate({ ...base, p: 1, start: 1.15, bet: pct, rounds: 1 })!.medianFinal).toBe(2.3);
    expect(simulate({ ...base, p: 1, start: 0.29, bet: pct, rounds: 1 })!.medianFinal).toBe(0.58);
  });
  it('counts a run that cannot afford the next bet after the last round as ruined', () => {
    expect(simulate({ ...base, p: 0, rounds: 2 })).toMatchObject({ ruinProb: 1, medianFinal: 2 });
    expect(simulate({ ...base, p: 0, rounds: 1 })).toMatchObject({ ruinProb: 0, medianFinal: 6 });
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
  it('rejects bets below one precision unit (precision-0 ruin reproduction)', () => {
    // Before the fix: minBet 0.1 at 0 decimals rounded every loss back to the same balance → ruin 0%.
    const r = validateSimInput({ ...okRaw, betMode: 'percent', percent: '10', minBet: '0.1', start: '10', precision: '0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.minBet).toBe('Must be at least 1 at 0 decimals');
    const f = validateSimInput({ ...okRaw, bet: '0.4', start: '10', precision: '0' });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.errors.bet).toBe('Must be at least 1 at 0 decimals');
    const t = validateSimInput({ ...okRaw, bet: '0.001', precision: '2' });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.errors.bet).toBe('Must be at least 0.01 at 2 decimals');
  });
  it('rejects bets with more decimals than precision', () => {
    const r = validateSimInput({ ...okRaw, bet: '1.5', start: '10', precision: '0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.bet).toBe('Use at most 0 decimals');
    const m = validateSimInput({ ...okRaw, betMode: 'percent', percent: '10', minBet: '0.125', precision: '2' });
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.errors.minBet).toBe('Use at most 2 decimals');
    // Trailing zeros are fine.
    expect(validateSimInput({ ...okRaw, bet: '1.00', start: '10', precision: '0' }).ok).toBe(true);
  });
  it('a valid precision-0 config ruins as expected', () => {
    const r = validateSimInput({ ...okRaw, p: '0.0001', multiplier: '2', betMode: 'percent', percent: '10', minBet: '1', start: '10', rounds: '200', runs: '50', precision: '0' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(simulate(r.value)?.ruinProb).toBe(1);
  });
  it('rejects multiplier above 1000 and start above 1e12', () => {
    const r = validateSimInput({ ...okRaw, multiplier: '1000.01', start: '1000000000001' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['multiplier', 'start']);
    expect(validateSimInput({ ...okRaw, multiplier: '1000', start: '1000000000000' }).ok).toBe(true);
  });
  it('rejects seed above 2^32-1', () => {
    expect(validateSimInput({ ...okRaw, seed: '4294967296' }).ok).toBe(false);
    expect(validateSimInput({ ...okRaw, seed: '4294967295' }).ok).toBe(true);
  });
});
