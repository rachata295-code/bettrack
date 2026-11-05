'use client';

import { useSyncExternalStore } from 'react';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';

const subscribe = (cb: () => void) => {
  const a = useBetStore.persist.onFinishHydration(cb);
  const b = useSettingsStore.persist.onFinishHydration(cb);
  const c = useWalletStore.persist.onFinishHydration(cb);
  return () => {
    a();
    b();
    c();
  };
};
const snapshot = () => useBetStore.persist.hasHydrated() &&
  useSettingsStore.persist.hasHydrated() &&
  useWalletStore.persist.hasHydrated();

/** False on the server and first client render so SSR markup matches; true once all stores loaded. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
