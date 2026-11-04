import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { clearLoadIssue, getLoadIssue, getLoadIssues, setStorageErrorHandler } from '@/store/storage';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';

const KEY = 'bettrack:v1:bets';
const balanceOfActive = () => {
  const s = useBetStore.getState();
  const a = s.sessions.find(x => x.id === s.activeSessionId)!;
  return currentBalance(a.initialBalance, computeTimeline(a.initialBalance, a.rounds));
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  clearLoadIssue();
  vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  useBetStore.getState().resetAll();
  vi.advanceTimersByTime(1000);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('persists to localStorage and rehydrates', async () => {
  useBetStore.getState().recordRound('win', '4', '2.03');
  const snapshot = localStorage.getItem(KEY)!;
  expect(snapshot).toContain('"sessions"');
  useBetStore.getState().resetAll();
  expect(balanceOfActive()).toBe('16.99');
  localStorage.setItem(KEY, snapshot);
  await useBetStore.persist.rehydrate();
  expect(balanceOfActive()).toBe('21.11');
  expect(getLoadIssue()).toBeNull();
});

it('corrupt storage sets loadIssue and is not overwritten', async () => {
  localStorage.setItem(KEY, '{broken');
  await useBetStore.persist.rehydrate();
  expect(getLoadIssue()).toMatchObject({ key: KEY, raw: '{broken' });
  useBetStore.getState().createSession();
  expect(localStorage.getItem(KEY)).toBe('{broken');
});

it('schema-invalid sessions set loadIssue too', async () => {
  const bad = JSON.stringify({ state: { sessions: [{ id: 'x' }], activeSessionId: 'x' }, version: 1 });
  localStorage.setItem(KEY, bad);
  await useBetStore.persist.rehydrate();
  expect(getLoadIssue()).toMatchObject({ key: KEY, raw: bad });
  expect(localStorage.getItem(KEY)).toBe(bad);
});

it('clearLoadIssue re-enables writes', async () => {
  localStorage.setItem(KEY, '{broken');
  await useBetStore.persist.rehydrate();
  clearLoadIssue();
  useBetStore.getState().createSession();
  expect(localStorage.getItem(KEY)).not.toBe('{broken');
});

it('quota error calls handler instead of throwing', () => {
  const handler = vi.fn();
  setStorageErrorHandler(handler);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(() => useBetStore.getState().createSession()).not.toThrow();
  expect(handler).toHaveBeenCalled();
});

it('settings clamp precision and fall back on invalid stored value', async () => {
  useSettingsStore.getState().setPrecision(99);
  expect(useSettingsStore.getState().precision).toBe(8);
  useSettingsStore.getState().setPrecision(-3);
  expect(useSettingsStore.getState().precision).toBe(0);
  localStorage.setItem('bettrack:v1:settings', JSON.stringify({ state: { precision: 'x' }, version: 1 }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().precision).toBe(2);
  expect(getLoadIssue()).toBeNull();
});

it('keeps an issue per key when both stores are corrupt', async () => {
  localStorage.setItem(KEY, '{bad-bets');
  localStorage.setItem('bettrack:v1:settings', '{bad-settings');
  await useBetStore.persist.rehydrate();
  await useSettingsStore.persist.rehydrate();
  expect(getLoadIssues().map(i => i.key)).toEqual([KEY, 'bettrack:v1:settings']);
  expect(getLoadIssue()).toMatchObject({ key: KEY });
  useBetStore.getState().createSession();
  useSettingsStore.getState().setPrecision(4);
  expect(localStorage.getItem(KEY)).toBe('{bad-bets');
  expect(localStorage.getItem('bettrack:v1:settings')).toBe('{bad-settings');
  clearLoadIssue(KEY);
  expect(getLoadIssues().map(i => i.key)).toEqual(['bettrack:v1:settings']);
});

it('a throwing storage error handler does not escape', () => {
  setStorageErrorHandler(() => {
    throw new Error('boom');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(() => useBetStore.getState().createSession()).not.toThrow();
});

it('persists drafts and rehydrates them (I1)', async () => {
  const id = useBetStore.getState().activeSessionId;
  useBetStore.getState().setDraft(id, { bet: '8' });
  const snapshot = localStorage.getItem(KEY)!;
  useBetStore.getState().resetAll();
  localStorage.setItem(KEY, snapshot);
  await useBetStore.persist.rehydrate();
  expect(useBetStore.getState().drafts[id]).toEqual({ bet: '8', multiplier: '2.03' });
});

it('invalid or orphan drafts are dropped without a loadIssue (I1)', async () => {
  const id = useBetStore.getState().activeSessionId;
  const parsed = JSON.parse(localStorage.getItem(KEY)!);
  parsed.state.drafts = { [id]: { bet: 8, multiplier: '2' }, ghost: { bet: '1', multiplier: '2' } };
  localStorage.setItem(KEY, JSON.stringify(parsed));
  await useBetStore.persist.rehydrate();
  expect(getLoadIssue()).toBeNull();
  expect(useBetStore.getState().drafts).toEqual({});
  parsed.state.drafts = 'garbage';
  localStorage.setItem(KEY, JSON.stringify(parsed));
  await useBetStore.persist.rehydrate();
  expect(getLoadIssue()).toBeNull();
  expect(useBetStore.getState().drafts).toEqual({});
});

it('legacy data without drafts still loads (I1)', async () => {
  const parsed = JSON.parse(localStorage.getItem(KEY)!);
  delete parsed.state.drafts;
  localStorage.setItem(KEY, JSON.stringify(parsed));
  await useBetStore.persist.rehydrate();
  expect(getLoadIssue()).toBeNull();
  expect(useBetStore.getState().drafts).toEqual({});
});

describe('blocked / failing storage (I3)', () => {
  it('reports an error when localStorage access itself throws (e.g. Safari "Block All Cookies")', async () => {
    const handler = vi.fn();
    setStorageErrorHandler(handler);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => useBetStore.getState().createSession()).not.toThrow();
    expect(handler).toHaveBeenCalled();
    handler.mockClear();
    await useBetStore.persist.rehydrate();
    expect(handler).toHaveBeenCalled();
    // Nothing could be read, so there is nothing to protect: no recovery screen.
    expect(getLoadIssue()).toBeNull();
  });

  it('a getItem throw records a read_error issue so later writes cannot clobber real data', async () => {
    const handler = vi.fn();
    setStorageErrorHandler(handler);
    const before = localStorage.getItem(KEY);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('io', 'UnknownError');
    });
    await useBetStore.persist.rehydrate();
    spy.mockRestore();
    expect(handler).toHaveBeenCalled();
    expect(getLoadIssue()).toMatchObject({ key: KEY, kind: 'read_error' });
    useBetStore.getState().createSession();
    expect(localStorage.getItem(KEY)).toBe(before);
  });

  it('corrupt data is reported as kind corrupt', async () => {
    localStorage.setItem(KEY, '{broken');
    await useBetStore.persist.rehydrate();
    expect(getLoadIssue()).toMatchObject({ key: KEY, kind: 'corrupt' });
  });

  it('errors raised before a handler is registered are delivered on registration', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setStorageErrorHandler(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    useBetStore.getState().createSession();
    const handler = vi.fn();
    setStorageErrorHandler(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    setStorageErrorHandler(vi.fn());
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
