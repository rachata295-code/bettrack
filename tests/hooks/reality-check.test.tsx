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

describe('useRealityCheck', () => {
  it('opens once the interval passes, with elapsed + P&L text', () => {
    const { result } = renderHook(() => useRealityCheck());
    expect(result.current.open).toBe(false);
    mins(29);
    expect(result.current.open).toBe(false);
    mins(2);
    expect(result.current.open).toBe(true);
    expect(result.current.elapsedText).toBe('31m');
    expect(result.current.pnlText).toBe('−4.00 USDT');
    expect(result.current.sessionName).toBe('Session 1');
  });
  it('does not reopen after keepPlaying until the next interval', () => {
    const { result } = renderHook(() => useRealityCheck());
    mins(31);
    act(() => result.current.keepPlaying());
    expect(result.current.open).toBe(false);
    mins(20); // 51 min, dueIndex still 1
    expect(result.current.open).toBe(false);
    mins(10); // 61 min -> dueIndex 2
    expect(result.current.open).toBe(true);
  });
  it('takeBreak starts the cooldown and acks', () => {
    const { result } = renderHook(() => useRealityCheck());
    mins(31);
    act(() => result.current.takeBreak());
    expect(result.current.open).toBe(false);
    expect(useBetStore.getState().cooldownUntil).toBe(Date.now() + DEFAULT_GUARD.lossStreak.cooldownMin * 60_000);
  });
  it('never opens when disabled, and clears its interval on unmount', () => {
    useSettingsStore.setState({ realityCheck: { enabled: false, intervalMin: 30 } });
    const { result, unmount } = renderHook(() => useRealityCheck());
    mins(120);
    expect(result.current.open).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a recorded round re-evaluates immediately', () => {
    const { result } = renderHook(() => useRealityCheck());
    act(() => { vi.setSystemTime(new Date('2026-11-05T03:40:00Z')); }); // clock jumps, no timer fires
    expect(result.current.open).toBe(false);
    vi.advanceTimersByTime(1100); // past duplicate window
    act(() => { useBetStore.getState().recordRound('lose', '1', '2'); });
    expect(result.current.open).toBe(true);
  });
});
