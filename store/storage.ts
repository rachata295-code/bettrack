import type { StateStorage } from 'zustand/middleware';
import { SessionSchema } from '@/lib/io/backup';

export const BETS_KEY = 'bettrack:v1:bets';
export const SETTINGS_KEY = 'bettrack:v1:settings';

export interface LoadIssue {
  key: string;
  raw: string;
}

// One issue per key so a second corrupt key can never unguard the first.
const loadIssues = new Map<string, LoadIssue>();
let storageErrorHandler: (err: unknown) => void = err => console.error('[bettrack] storage error', err);

// A throwing handler must not escape through zustand's set().
function onStorageError(err: unknown): void {
  try {
    storageErrorHandler(err);
  } catch {
    // ignore
  }
}

export const getLoadIssues = (): LoadIssue[] => [...loadIssues.values()];
export const getLoadIssue = (): LoadIssue | null => loadIssues.values().next().value ?? null;
export const clearLoadIssue = (key?: string): void => {
  if (key === undefined) loadIssues.clear();
  else loadIssues.delete(key);
};
export const setStorageErrorHandler = (fn: (err: unknown) => void): void => {
  storageErrorHandler = fn;
};

// SSR / blocked storage: behave as an empty store instead of throwing.
function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isValidPrecision = (p: unknown): boolean => Number.isInteger(p) && (p as number) >= 0 && (p as number) <= 8;

/** Returns the raw string to hand to zustand, or null when the data is unusable. */
function validate(name: string, raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const state = (parsed as { state?: Record<string, unknown> } | null)?.state;
  if (!state || typeof state !== 'object') return null;
  if (name === BETS_KEY) {
    return SessionSchema.array().safeParse(state.sessions).success ? raw : null;
  }
  if (name === SETTINGS_KEY && !isValidPrecision(state.precision)) {
    // A bad precision is harmless: fall back to the default rather than blocking the app.
    return JSON.stringify({ ...(parsed as object), state: { ...state, precision: 2 } });
  }
  return raw;
}

export const safeStorage: StateStorage = {
  getItem(name) {
    const store = ls();
    if (!store) return null;
    let raw: string | null;
    try {
      raw = store.getItem(name);
    } catch (err) {
      onStorageError(err);
      return null;
    }
    if (raw === null) return null;
    const ok = validate(name, raw);
    if (ok === null) {
      // Keep the raw text so the user can export/recover it; setItem refuses to overwrite it.
      loadIssues.set(name, { key: name, raw });
      return null;
    }
    return ok;
  },
  setItem(name, value) {
    // Never clobber data we failed to load: the user may still be able to recover it.
    if (loadIssues.has(name)) return;
    try {
      ls()?.setItem(name, value);
    } catch (err) {
      onStorageError(err);
    }
  },
  removeItem(name) {
    if (loadIssues.has(name)) return;
    try {
      ls()?.removeItem(name);
    } catch (err) {
      onStorageError(err);
    }
  },
};
