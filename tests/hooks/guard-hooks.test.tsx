import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardNotices } from '@/components/guard/guard-notices';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';
import { useGuard } from '@/hooks/use-guard';
import { CHASING_MESSAGE, useGuardedRecord } from '@/hooks/use-guarded-record';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

// Sonner is mocked so the chasing warning can be asserted without rendering a Toaster.
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const active = () => {
  const st = useBetStore.getState();
  return st.sessions.find(s => s.id === st.activeSessionId)!;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T05:00:00Z'));
  localStorage.clear();
  useBetStore.getState().resetAll();
  useSettingsStore.setState({ guard: DEFAULT_GUARD, precision: 2 });
  // Stop-loss already reached so every record goes through the confirmation.
  useBetStore.getState().updateSession(active().id, { guard: { stopLoss: { kind: 'amount', value: '1' } } });
  useBetStore.getState().recordRound('lose', '4', '2');
  vi.advanceTimersByTime(1000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Remove the beforeEach stop-loss so records save directly instead of asking for confirmation. */
const clearLimits = () => useBetStore.getState().updateSession(active().id, { guard: {} });
const setGuard = (patch: Partial<typeof DEFAULT_GUARD>) =>
  useSettingsStore.setState({ guard: { ...DEFAULT_GUARD, ...patch } });

describe('useGuardedRecord', () => {
  it('confirm records the bet/multiplier captured at click time', () => {
    const { result, rerender } = renderHook(({ bet }) => useGuardedRecord(bet, '2'), { initialProps: { bet: '1' } });
    act(() => result.current.record('win'));
    expect(result.current.pending?.bet).toBe('1');
    rerender({ bet: '3' }); // draft edited while the dialog is open
    act(() => result.current.confirm());
    expect(result.current.pending).toBeNull();
    expect(active().rounds.at(-1)).toMatchObject({ result: 'win', bet: '1' });
  });

  it('drops the pending request when the active session changes', () => {
    const { result } = renderHook(() => useGuardedRecord('1', '2'));
    act(() => result.current.record('win'));
    expect(result.current.pending).not.toBeNull();
    act(() => {
      useBetStore.getState().createSession({ name: 'B' });
    });
    expect(result.current.pending).toBeNull();
    act(() => result.current.confirm());
    expect(active().rounds).toHaveLength(0);
  });
});

describe('useGuardedRecord guard rules', () => {
  it('record() is blocked while a break is running', () => {
    clearLimits();
    act(() => useBetStore.getState().startCooldown(1));
    const { result } = renderHook(() => useGuardedRecord('1', '2'));
    act(() => result.current.record('win'));
    expect(result.current.pending).toBeNull();
    expect(active().rounds).toHaveLength(1);
  });

  it('hard mode starts a break when the n-th consecutive LOSE is saved', () => {
    clearLimits();
    setGuard({ lossStreak: { enabled: true, n: 3, mode: 'hard', cooldownMin: 5 } });
    const { result } = renderHook(() => useGuardedRecord('1', '2'));
    act(() => result.current.record('lose')); // 2nd loss in a row
    expect(useBetStore.getState().cooldownUntil).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.record('lose')); // 3rd loss in a row
    expect(useBetStore.getState().cooldownUntil).toBe(Date.now() + 5 * 60_000);
  });

  it('soft mode never starts a break', () => {
    clearLimits();
    setGuard({ lossStreak: { enabled: true, n: 3, mode: 'soft', cooldownMin: 5 } });
    const { result } = renderHook(() => useGuardedRecord('1', '2'));
    act(() => result.current.record('lose'));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.record('lose'));
    expect(active().rounds).toHaveLength(3);
    expect(useBetStore.getState().cooldownUntil).toBeNull();
  });

  it('warns about chasing when the bet is raised right after a loss', () => {
    clearLimits();
    const { result } = renderHook(() => useGuardedRecord('5', '2')); // last round: LOSE at 4
    act(() => result.current.record('win'));
    expect(toastMock.warning).toHaveBeenCalledWith(CHASING_MESSAGE);
  });

  it('no chasing warning when chasingAlert is off', () => {
    clearLimits();
    setGuard({ chasingAlert: false });
    const { result } = renderHook(() => useGuardedRecord('5', '2'));
    act(() => result.current.record('win'));
    expect(active().rounds).toHaveLength(2);
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it('cancel() closes the confirmation and records nothing', () => {
    const { result } = renderHook(() => useGuardedRecord('1', '2'));
    act(() => result.current.record('win'));
    expect(result.current.pending).not.toBeNull();
    act(() => result.current.cancel());
    expect(result.current.pending).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(active().rounds).toHaveLength(1);
  });
});

describe('useGuard daily figures', () => {
  it('daily loss progress resets at Bangkok midnight on a page left open', () => {
    setGuard({ dailyLossLimit: '10' });
    const { result } = renderHook(() => useGuard('1'));
    const daily = () => result.current.progress.find(p => p.hit === 'daily_loss');
    expect(daily()?.used).toBe('4'); // the 05:00Z (12:00 Bangkok) loss
    act(() => vi.advanceTimersByTime(12 * 3_600_000)); // 17:00:01Z = 00:00:01 Bangkok next day
    expect(daily()?.used).toBe('0');
  });
});

describe('useGuard cooldown', () => {
  it('shows the full break immediately on a long-open page, then counts down', () => {
    const { result } = renderHook(() => useGuard('1'));
    vi.advanceTimersByTime(10 * 60_000); // page left open; no ticker runs while idle
    act(() => useBetStore.getState().startCooldown(1));
    expect(result.current.cooldownRemainingMs).toBe(60_000);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.cooldownRemainingMs).toBe(59_000);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.cooldownRemainingMs).toBe(0);
  });
});

describe('GuardNotices', () => {
  it('a dismissed banner shows again for a new streak after the streak was broken', () => {
    const view = (n: number) => <GuardNotices streakAlert={n >= 3} lossStreak={n} cooldownRemainingMs={0} />;
    const { rerender } = render(view(3));
    fireEvent.click(screen.getByLabelText('Dismiss loss streak notice'));
    expect(screen.queryByRole('status')).toBeNull();
    rerender(view(0)); // WIN
    rerender(view(3)); // three new losses
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
