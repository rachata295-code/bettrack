import type { StateStorage } from 'zustand/middleware';
import { SessionSchema } from '@/lib/io/backup';

export const BETS_KEY = 'bettrack:v1:bets';
export const SETTINGS_KEY = 'bettrack:v1:settings';

export interface LoadIssue {
  key: string;
  raw: string;
  // corrupt: stored text failed validation. read_error: getItem threw, so the real data is unknown
  // (possibly fine) and must neither be overwritten nor reset.
  kind: 'corrupt' | 'read_error';
}

// One issue per key so a second corrupt key can never unguard the first.
const loadIssues = new Map<string, LoadIssue>();
let storageErrorHandler: ((err: unknown) => void) | null = null;
// Stores hydrate at module load, before any UI can register a handler; keep those errors for it.
const pendingErrors: unknown[] = [];
const MAX_PENDING = 5;

// A throwing handler must not escape through zustand's set().
function onStorageError(err: unknown): void {
  if (!storageErrorHandler) {
    console.error('[bettrack] storage error', err);
    if (pendingErrors.length < MAX_PENDING) pendingErrors.push(err);
    return;
  }
  try {
    storageErrorHandler(err);
  } catch {
    // ignore
  }
}

// Keys whose latest write failed: this tab holds newer state than storage, so it must not rehydrate them.
const unsavedKeys = new Set<string>();
export const hasUnsavedWrite = (key: string): boolean => unsavedKeys.has(key);

export const getLoadIssues = (): LoadIssue[] => [...loadIssues.values()];
export const getLoadIssue = (): LoadIssue | null => loadIssues.values().next().value ?? null;
export const clearLoadIssue = (key?: string): void => {
  if (key === undefined) loadIssues.clear();
  else loadIssues.delete(key);
};
/** Registers the UI error reporter and flushes errors raised before it existed. null unregisters. */
export const setStorageErrorHandler = (fn: ((err: unknown) => void) | null): void => {
  storageErrorHandler = fn;
  if (!fn) return;
  for (const err of pendingErrors.splice(0)) onStorageError(err);
};

// SSR: silently behave as an empty store. In the browser, a throwing/missing localStorage
// (Safari "Block All Cookies", disabled DOM storage) means nothing will be saved, so say so.
function ls(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const store = window.localStorage;
    if (store) return store;
    onStorageError(new Error('localStorage is unavailable'));
  } catch (err) {
    onStorageError(err);
  }
  return null;
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
      // The data may still be there: block writes so defaults can't overwrite it.
      loadIssues.set(name, { key: name, raw: '', kind: 'read_error' });
      onStorageError(err);
      return null;
    }
    if (raw === null) return null;
    const ok = validate(name, raw);
    if (ok === null) {
      // Keep the raw text so the user can export/recover it; setItem refuses to overwrite it.
      loadIssues.set(name, { key: name, raw, kind: 'corrupt' });
      return null;
    }
    return ok;
  },
  setItem(name, value) {
    // Never clobber data we failed to load: the user may still be able to recover it.
    if (loadIssues.has(name)) return;
    const store = ls();
    if (!store) {
      if (typeof window !== 'undefined') unsavedKeys.add(name);
      return;
    }
    try {
      store.setItem(name, value);
      unsavedKeys.delete(name);
    } catch (err) {
      unsavedKeys.add(name);
      onStorageError(err);
    }
  },
  removeItem(name) {
    if (loadIssues.has(name)) return;
    const store = ls();
    if (!store) return;
    try {
      store.removeItem(name);
    } catch (err) {
      onStorageError(err);
    }
  },
};
