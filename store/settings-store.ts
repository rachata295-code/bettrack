import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SETTINGS_KEY, safeStorage } from './storage';

export const DEFAULT_PRECISION = 2;

interface SettingsState {
  precision: number;
  setPrecision: (p: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      precision: DEFAULT_PRECISION,
      setPrecision: p => {
        // Clamp (not reject) so a slider/input can never push display into an invalid range.
        const n = Number.isFinite(p) ? Math.trunc(p) : DEFAULT_PRECISION;
        set({ precision: Math.min(8, Math.max(0, n)) });
      },
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: s => ({ precision: s.precision }),
      migrate: persisted => persisted as SettingsState,
    },
  ),
);
