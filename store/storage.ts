import type { StateStorage } from 'zustand/middleware';
import { SessionSchema } from '@/lib/io/backup';

export const BETS_KEY = 'bettrack:v1:bets';
export const SETTINGS_KEY = 'bettrack:v1:settings';

export interface LoadIssue {
  key: string;
  raw: string;
}

let loadIssue: LoadIssue | null = null;
let onStorageError: (err: unknown) => void = err => console.error('[bettrack] storage error', err);

export const getLoadIssue = (): LoadIssue | null => loadIssue;
export const clearLoadIssue = (): void => {
  loadIssue = null;
};
export const setStorageErrorHandler = (fn: (err: unknown) => void): void => {
  onStorageError = fn;
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
      loadIssue = { key: name, raw };
      return null;
    }
    return ok;
  },
  setItem(name, value) {
    // Never clobber data we failed to load: the user may still be able to recover it.
    if (loadIssue?.key === name) return;
    try {
      ls()?.setItem(name, value);
    } catch (err) {
      onStorageError(err);
    }
  },
  removeItem(name) {
    if (loadIssue?.key === name) return;
    try {
      ls()?.removeItem(name);
    } catch (err) {
      onStorageError(err);
    }
  },
};
