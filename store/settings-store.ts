import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_GUARD, sanitizeGuard, validateGuardPatch } from '@/lib/calculations/guard';
import type { DeepPartial, GuardSettings } from '@/types';
import { SETTINGS_KEY, safeStorage } from './storage';

export const DEFAULT_PRECISION = 2;

interface SettingsState {
  precision: number;
  setPrecision: (p: number) => void;
  guard: GuardSettings;
  /** Validates the merged result; on failure nothing changes. */
  setGuard: (patch: DeepPartial<GuardSettings>) => { ok: true } | { ok: false; errors: Record<string, string> };
  resetGuard: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      precision: DEFAULT_PRECISION,
      setPrecision: p => {
        // Clamp (not reject) so a slider/input can never push display into an invalid range.
        const n = Number.isFinite(p) ? Math.trunc(p) : DEFAULT_PRECISION;
        set({ precision: Math.min(8, Math.max(0, n)) });
      },
      guard: DEFAULT_GUARD,
      setGuard: patch => {
        const r = validateGuardPatch(get().guard, patch);
        if (!r.ok) return r;
        set({ guard: r.value });
        return { ok: true };
      },
      resetGuard: () => set({ guard: DEFAULT_GUARD }),
    }),
    {
      name: SETTINGS_KEY,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: s => ({ precision: s.precision, guard: s.guard }),
      // v1 -> v2: guard did not exist yet.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return (version < 2 ? { ...p, guard: DEFAULT_GUARD } : p) as SettingsState;
      },
      // Last line of defence: a malformed guard (e.g. edited by hand) must never reach the UI.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, guard: sanitizeGuard(p.guard) };
      },
    },
  ),
);
