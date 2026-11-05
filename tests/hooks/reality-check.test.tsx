import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealityCheck } from '@/hooks/use-reality-check';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';
import { DEFAULT_REALITY_CHECK } from '@/lib/calculations/reality-check';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T03:00:00Z')); // 10:00 BKK
  localStorage.clear();
  useBetStore.getState().resetAll();
  useSettingsStore.setState({ realityCheck: DEFAULT_REALITY_CHECK, guard: DEFAULT_GUARD, precision: 2 });
  useBetStore.getState().recordRound('lose', '4', '2'); // first round of the day, -4
});
afterEach(() => vi.useRealTimers());

const mins = (n: number) => act(() => { vi.advanceTimersByTime(n * 60_000); });

// Records a round every 10 minutes for `total` minutes (gaps ≤ 15 min = active play time).
const play = (total: number) => {
  for (let t = 10; t <= total; t += 10) {
    mins(10);
    act(() => { useBetStore.getState().recordRound('win', '1', '2'); });
  }
};

describe('useRealityCheck (R19: active play only)', () => {
  it('opens once active play reaches the interval, with play time + P&L text', () => {
    const { result } = renderHook(() => useRealityCheck());
    play(20);
    expect(result.current.open).toBe(false);
    play(10); // 10:00..10:30 → 30 active minutes
    expect(result.current.open).toBe(true);
    expect(result.current.elapsedText).toBe('30m');
    expect(result.current.pnlText).toBe('−1.00 USDT'); // −4 + 3 × (+1)
    expect(result.current.sessionName).toBe('Session 1');
  });
  it('does not open from wall-clock time alone (one round, then idle)', () => {
    const { result } = renderHook(() => useRealityCheck());
    mins(31);
    expect(result.current.open).toBe(false);
  });
  it('rounds 10:00–10:40 then nothing: not open at 20:00', () => {
    const { result } = renderHook(() => useRealityCheck());
    play(40);
    expect(result.current.open).toBe(true);
    act(() => { vi.setSystemTime(new Date('2026-11-05T13:00:00Z')); }); // 20:00 BKK
    mins(1);
    expect(result.current.open).toBe(false);
  });
  it('does not reopen after keepPlaying until the next interval', () => {
    const { result } = renderHook(() => useRealityCheck());
    play(30);
    act(() => result.current.keepPlaying());
    expect(result.current.open).toBe(false);
    play(20); // 50 active min, dueIndex still 1
    expect(result.current.open).toBe(false);
    play(10); // 60 -> dueIndex 2
    expect(result.current.open).toBe(true);
  });
  it('takeBreak starts the cooldown and acks', () => {
    const { result } = renderHook(() => useRealityCheck());
    play(30);
    act(() => result.current.takeBreak());
    expect(result.current.open).toBe(false);
    expect(useBetStore.getState().cooldownUntil).toBe(Date.now() + DEFAULT_GUARD.lossStreak.cooldownMin * 60_000);
  });
  it('never opens when disabled, and clears its interval on unmount', () => {
    useSettingsStore.setState({ realityCheck: { enabled: false, intervalMin: 30 } });
    const { result, unmount } = renderHook(() => useRealityCheck());
    play(120);
    expect(result.current.open).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a recorded round re-evaluates immediately', () => {
    const { result } = renderHook(() => useRealityCheck());
    play(20); // 20 active minutes
    act(() => { vi.setSystemTime(new Date('2026-11-05T03:35:00Z')); }); // clock jumps 15 min, no timer fires
    expect(result.current.open).toBe(false);
    act(() => { useBetStore.getState().recordRound('lose', '1', '2'); }); // gap 15 → 35 active
    expect(result.current.open).toBe(true);
  });
});
