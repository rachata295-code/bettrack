import { useBetStore } from './bet-store';
import { useSettingsStore } from './settings-store';
import { BETS_KEY, SETTINGS_KEY, hasUnsavedWrite } from './storage';

const KEY_PREFIX = 'bettrack:v1:';

const stores = [
  { key: BETS_KEY, persist: () => useBetStore.persist },
  { key: SETTINGS_KEY, persist: () => useSettingsStore.persist },
];

function rehydrate(key?: string): void {
  for (const s of stores) {
    if (key !== undefined && s.key !== key) continue;
    // A failed write means memory is newer than storage; reloading would silently drop those rounds.
    if (hasUnsavedWrite(s.key)) continue;
    void s.persist().rehydrate();
  }
}

/**
 * Persist writes whole state, so a stale tab would overwrite rounds recorded in another tab.
 * Re-read storage whenever another tab writes (storage event) or this tab comes back into view
 * (visibilitychange / bfcache pageshow, where storage events may have been missed).
 * Returns a cleanup function.
 */
export function startStorageSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    // key === null means localStorage.clear() in another tab.
    if (e.key === null) rehydrate();
    else if (e.key.startsWith(KEY_PREFIX)) rehydrate(e.key);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') rehydrate();
  };
  const onPageShow = () => rehydrate();
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  return () => {
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
  };
}
