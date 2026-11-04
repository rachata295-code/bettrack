import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { clearLoadIssue, setStorageErrorHandler } from '@/store/storage';
import { startStorageSync } from '@/store/sync';

const KEY = 'bettrack:v1:bets';
const roundsOfActive = () => {
  const s = useBetStore.getState();
  return s.sessions.find(x => x.id === s.activeSessionId)!.rounds;
};
let stop: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  clearLoadIssue();
  vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  useBetStore.getState().resetAll();
  vi.advanceTimersByTime(1000);
  stop = startStorageSync();
});
afterEach(() => {
  stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Simulates another tab: write its state straight to localStorage, then roll this tab back.
function otherTabRecordsAWin(): string {
  useBetStore.getState().recordRound('win', '4', '2.03');
  const theirs = localStorage.getItem(KEY)!;
  return theirs;
}

it('rehydrates the bet store on a storage event for its key (I2)', () => {
  const before = localStorage.getItem(KEY)!;
  const theirs = otherTabRecordsAWin();
  // This tab is stale: in-memory state without the round, storage has it.
  useBetStore.setState(JSON.parse(before).state);
  expect(roundsOfActive()).toHaveLength(0);
  localStorage.setItem(KEY, theirs);
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: theirs }));
  expect(roundsOfActive()).toHaveLength(1);
});

it('rehydrates settings on a storage event for the settings key and ignores other keys', () => {
  const settingsKey = 'bettrack:v1:settings';
  localStorage.setItem(settingsKey, JSON.stringify({ state: { precision: 5 }, version: 1 }));
  window.dispatchEvent(new StorageEvent('storage', { key: 'other-app', newValue: 'x' }));
  expect(useSettingsStore.getState().precision).not.toBe(5);
  window.dispatchEvent(new StorageEvent('storage', { key: settingsKey }));
  expect(useSettingsStore.getState().precision).toBe(5);
  useSettingsStore.getState().setPrecision(2);
});

it('rehydrates when the tab becomes visible again or is restored from bfcache', () => {
  const before = localStorage.getItem(KEY)!;
  const theirs = otherTabRecordsAWin();
  useBetStore.setState(JSON.parse(before).state);
  localStorage.setItem(KEY, theirs);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(roundsOfActive()).toHaveLength(1);
  // setState persists, so re-seed storage with the other tab's data afterwards.
  useBetStore.setState(JSON.parse(before).state);
  localStorage.setItem(KEY, theirs);
  window.dispatchEvent(new Event('pageshow'));
  expect(roundsOfActive()).toHaveLength(1);
});

it('does not rehydrate a store whose last write failed (keeps unsaved rounds in memory)', () => {
  setStorageErrorHandler(() => {});
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  useBetStore.getState().recordRound('win', '4', '2.03');
  spy.mockRestore();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(roundsOfActive()).toHaveLength(1);
});

it('stop() removes the listeners', () => {
  const before = localStorage.getItem(KEY)!;
  const theirs = otherTabRecordsAWin();
  useBetStore.setState(JSON.parse(before).state);
  localStorage.setItem(KEY, theirs);
  stop();
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  expect(roundsOfActive()).toHaveLength(0);
});
