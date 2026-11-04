'use client';

import { useSyncExternalStore } from 'react';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

const subscribe = (cb: () => void) => {
  const a = useBetStore.persist.onFinishHydration(cb);
  const b = useSettingsStore.persist.onFinishHydration(cb);
  return () => {
    a();
    b();
  };
};
const snapshot = () => useBetStore.persist.hasHydrated() && useSettingsStore.persist.hasHydrated();

/** False on the server and first client render so SSR markup matches; true once both stores loaded. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
