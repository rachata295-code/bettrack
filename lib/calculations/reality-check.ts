import type { RealityCheckSettings } from '@/types';

export const DEFAULT_REALITY_CHECK: RealityCheckSettings = { enabled: true, intervalMin: 30 };

/** Lenient read: anything malformed becomes the defaults. */
export function sanitizeRealityCheck(raw: unknown): RealityCheckSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_REALITY_CHECK;
  const r = raw as Record<string, unknown>;
  const n = r.intervalMin;
  if (typeof r.enabled !== 'boolean' || typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 1440) {
    return DEFAULT_REALITY_CHECK;
  }
  return { enabled: r.enabled, intervalMin: n };
}
