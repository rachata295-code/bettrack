import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardNotices } from '@/components/guard/guard-notices';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';
import { useGuard } from '@/hooks/use-guard';
import { useGuardedRecord } from '@/hooks/use-guarded-record';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

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
afterEach(() => vi.useRealTimers());

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
