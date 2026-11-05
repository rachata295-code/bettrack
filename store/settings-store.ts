import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_GUARD, sanitizeGuard, validateGuardPatch } from '@/lib/calculations/guard';
import {
  DEFAULT_FEES, DEFAULT_FX, sanitizeFees, sanitizeFx, validateFeesPatch, validateFxPatch,
} from '@/lib/calculations/fx';
import { DEFAULT_REALITY_CHECK, sanitizeRealityCheck, validateRealityCheck } from '@/lib/calculations/reality-check';
import type { DeepPartial, FeeSettings, FxRates, GuardSettings, RealityCheckSettings } from '@/types';
import { SETTINGS_KEY, safeStorage } from './storage';

export const DEFAULT_PRECISION = 2;

interface SettingsState {
  precision: number;
  setPrecision: (p: number) => void;
  guard: GuardSettings;
  /** Validates the merged result; on failure nothing changes. */
  setGuard: (patch: DeepPartial<GuardSettings>) => { ok: true } | { ok: false; errors: Record<string, string> };
  resetGuard: () => void;
  fx: FxRates;
  /** Keys given are merged into the current rates; '' removes one. Nothing changes on failure. */
  setFx: (patch: Partial<FxRates>) => { ok: true } | { ok: false; errors: Record<string, string> };
  fees: FeeSettings;
  setFees: (patch: Partial<FeeSettings>) => { ok: true } | { ok: false; errors: Record<string, string> };
  realityCheck: RealityCheckSettings;
  /** Validates the merged result (interval: whole minutes 5-240); nothing changes on failure. */
  setRealityCheck: (patch: Partial<RealityCheckSettings>) => { ok: true } | { ok: false; errors: Record<string, string> };
  resetFxFees: () => void;
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
      fx: DEFAULT_FX,
      setFx: patch => {
        const r = validateFxPatch({ ...get().fx, ...patch });
        if (!r.ok) return r;
        set({ fx: r.value });
        return { ok: true };
      },
      fees: DEFAULT_FEES,
      setFees: patch => {
        const r = validateFeesPatch(get().fees, patch);
        if (!r.ok) return r;
        set({ fees: r.value });
        return { ok: true };
      },
      realityCheck: DEFAULT_REALITY_CHECK,
      setRealityCheck: patch => {
        const r = validateRealityCheck({ ...get().realityCheck, ...patch });
        if (!r.ok) return r;
        set({ realityCheck: r.value });
        return { ok: true };
      },
      resetFxFees: () => set({ fx: DEFAULT_FX, fees: DEFAULT_FEES, realityCheck: DEFAULT_REALITY_CHECK }),
    }),
    {
      name: SETTINGS_KEY,
      version: 3,
      storage: createJSONStorage(() => safeStorage),
      partialize: s => ({ precision: s.precision, guard: s.guard, fx: s.fx, fees: s.fees, realityCheck: s.realityCheck }),
      // v1 -> v2: guard did not exist yet. v2 -> v3: fx, fees and realityCheck did not exist yet.
      migrate: (persisted, version) => {
        let p = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2) p = { ...p, guard: DEFAULT_GUARD };
        if (version < 3) p = { ...p, fx: DEFAULT_FX, fees: DEFAULT_FEES, realityCheck: DEFAULT_REALITY_CHECK };
        return p as SettingsState;
      },
      // Last line of defence: malformed guard/fx/fees (e.g. edited by hand) must never reach the UI.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          guard: sanitizeGuard(p.guard),
          fx: sanitizeFx(p.fx),
          fees: sanitizeFees(p.fees),
          realityCheck: sanitizeRealityCheck(p.realityCheck),
        };
      },
    },
  ),
);
