import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSimulation } from '@/hooks/use-simulation';
import type { SimInput } from '@/lib/calculations/montecarlo';

const input: SimInput = { p: 0.5, multiplier: 2, start: 10, bet: { mode: 'fixed', amount: 1 }, rounds: 10, runs: 10, seed: 1, precision: 0 };

describe('useSimulation', () => {
  it('snapshots currency and precision when a run starts', () => {
    const { result } = renderHook(() => useSimulation());
    expect(result.current.display).toBeNull();
    act(() => result.current.run(input, 'THB'));
    // jsdom has no Worker, so the run fails, but the snapshot is already taken from the run call.
    expect(result.current.display).toEqual({ currency: 'THB', precision: 0 });
    expect(result.current.input).toEqual(input);
  });
});
