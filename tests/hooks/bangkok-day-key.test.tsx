import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBangkokDayKey } from '@/hooks/use-bangkok-day-key';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T16:59:00Z')); // 23:59 Bangkok
});
afterEach(() => vi.useRealTimers());

describe('useBangkokDayKey', () => {
  it('rolls over at Bangkok midnight without any other re-render', () => {
    const { result } = renderHook(() => useBangkokDayKey());
    expect(result.current).toBe('2026-11-05');
    act(() => vi.advanceTimersByTime(59_000));
    expect(result.current).toBe('2026-11-05');
    act(() => vi.advanceTimersByTime(2_000)); // past midnight + 1 s
    expect(result.current).toBe('2026-11-06');
    // Keeps scheduling: the next midnight also rolls over.
    act(() => vi.advanceTimersByTime(86_400_000));
    expect(result.current).toBe('2026-11-07');
  });

  it('refreshes when the tab becomes visible again (timers may be throttled in background)', () => {
    const { result } = renderHook(() => useBangkokDayKey());
    // Jump the clock without firing timers, as a suspended phone tab would.
    vi.setSystemTime(new Date('2026-11-06T03:00:00Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-11-06');
  });

  it('clears its timer on unmount', () => {
    const { unmount } = renderHook(() => useBangkokDayKey());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
