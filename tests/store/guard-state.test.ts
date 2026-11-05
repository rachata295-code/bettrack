import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { clearLoadIssue, getLoadIssues } from '@/store/storage';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';

const SETTINGS = 'bettrack:v1:settings';
const BETS = 'bettrack:v1:bets';
const activeId = () => useBetStore.getState().activeSessionId;
const active = () => useBetStore.getState().sessions.find(s => s.id === activeId())!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  localStorage.clear();
  clearLoadIssue();
  useBetStore.getState().resetAll();
  useSettingsStore.setState({ guard: DEFAULT_GUARD });
  vi.advanceTimersByTime(1000);
});
afterEach(() => vi.useRealTimers());

it('defaults guard', () => expect(useSettingsStore.getState().guard).toEqual(DEFAULT_GUARD));

it('migrates v1 settings to include default guard', async () => {
  localStorage.setItem(SETTINGS, JSON.stringify({ state: { precision: 5 }, version: 1 }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().precision).toBe(5);
  expect(useSettingsStore.getState().guard).toEqual(DEFAULT_GUARD);
  expect(getLoadIssues()).toEqual([]);
});

it('invalid stored guard falls back to default without a load issue', async () => {
  const bad = { ...DEFAULT_GUARD, sizing: { mode: 'percent', percent: '500', minBet: '1' } };
  localStorage.setItem(SETTINGS, JSON.stringify({ state: { precision: 3, guard: bad }, version: 2 }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().guard).toEqual(DEFAULT_GUARD);
  expect(useSettingsStore.getState().precision).toBe(3);
  expect(getLoadIssues()).toEqual([]);
});

it('setGuard applies a valid patch and persists', async () => {
  expect(useSettingsStore.getState().setGuard({ sizing: { percent: '5' }, dailyLossLimit: '20' })).toEqual({ ok: true });
  expect(useSettingsStore.getState().guard.sizing.percent).toBe('5');
  const stored = JSON.parse(localStorage.getItem(SETTINGS)!);
  expect(stored.version).toBe(3);
  useSettingsStore.setState({ guard: DEFAULT_GUARD });
  localStorage.setItem(SETTINGS, JSON.stringify(stored));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().guard.dailyLossLimit).toBe('20');
  useSettingsStore.getState().setGuard({ dailyLossLimit: undefined });
  expect('dailyLossLimit' in useSettingsStore.getState().guard).toBe(false);
});

it('setGuard rejects invalid patches and leaves state untouched', () => {
  const before = useSettingsStore.getState().guard;
  expect(useSettingsStore.getState().setGuard({ sizing: { percent: '0' } }).ok).toBe(false);
  expect(useSettingsStore.getState().setGuard({ riskBands: { low: '30', high: '20' } }).ok).toBe(false);
  expect(useSettingsStore.getState().guard).toBe(before);
});

it('cooldown starts, persists across rehydrate and clears', async () => {
  const now = Date.now();
  useBetStore.getState().startCooldown(5);
  expect(useBetStore.getState().cooldownUntil).toBe(now + 5 * 60_000);
  const snapshot = localStorage.getItem(BETS)!;
  useBetStore.setState({ cooldownUntil: null });
  localStorage.setItem(BETS, snapshot);
  await useBetStore.persist.rehydrate();
  expect(useBetStore.getState().cooldownUntil).toBe(now + 5 * 60_000);
  useBetStore.getState().clearCooldown();
  expect(useBetStore.getState().cooldownUntil).toBeNull();
});

it('non-finite stored cooldown becomes null; resetAll clears it', async () => {
  const s = JSON.parse(JSON.stringify({ state: { sessions: useBetStore.getState().sessions, activeSessionId: activeId(), drafts: {}, cooldownUntil: 'soon' }, version: 1 }));
  localStorage.setItem(BETS, JSON.stringify(s));
  await useBetStore.persist.rehydrate();
  expect(useBetStore.getState().cooldownUntil).toBeNull();
  useBetStore.getState().startCooldown(1);
  useBetStore.getState().resetAll();
  expect(useBetStore.getState().cooldownUntil).toBeNull();
});

it('startCooldown ignores non-positive or non-finite minutes', () => {
  useBetStore.getState().startCooldown(0);
  useBetStore.getState().startCooldown(Number.NaN);
  expect(useBetStore.getState().cooldownUntil).toBeNull();
});

it('updateSession sets, validates and removes guard', () => {
  const id = activeId();
  const guard = { stopLoss: { kind: 'amount' as const, value: '5' }, takeProfit: { kind: 'percent' as const, value: '50' } };
  expect(useBetStore.getState().updateSession(id, { guard }).ok).toBe(true);
  expect(active().guard).toEqual(guard);
  for (const bad of [
    { stopLoss: { kind: 'percent' as const, value: '101' } },
    { stopLoss: { kind: 'amount' as const, value: '0' } },
    { takeProfit: { kind: 'amount' as const, value: '-2' } },
    { takeProfit: { kind: 'amount' as const, value: 'x' } },
  ]) {
    expect(useBetStore.getState().updateSession(id, { guard: bad }).ok).toBe(false);
  }
  expect(active().guard).toEqual(guard);
  expect(useBetStore.getState().updateSession(id, { guard: null }).ok).toBe(true);
  expect('guard' in active()).toBe(false);
});

it('session guard survives persist then rehydrate', async () => {
  const guard = { stopLoss: { kind: 'percent' as const, value: '25' } };
  useBetStore.getState().updateSession(activeId(), { guard });
  const snapshot = localStorage.getItem(BETS)!;
  useBetStore.getState().resetAll();
  localStorage.setItem(BETS, snapshot);
  await useBetStore.persist.rehydrate();
  expect(getLoadIssues()).toEqual([]);
  expect(active().guard).toEqual(guard);
});
