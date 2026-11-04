import { D, parseMoneyInput } from './money';
import type { Session } from '@/types';

/** Parse + normalize a multiplier; null when malformed or not > 1 (cannot be a real payout). */
function normalize(raw: string): string | null {
  const p = parseMoneyInput(raw);
  if (!p.ok || !D(p.value).gt(1)) return null;
  return p.value;
}

/**
 * Default multiplier first, then distinct previously used multipliers (across all sessions),
 * most recent round first. Dedupe is by Decimal value so "2" and "2.00" collapse into one chip.
 */
export function recentMultipliers(
  sessions: readonly Session[],
  opts: { defaultMultiplier: string; limit?: number },
): string[] {
  const limit = opts.limit ?? 6;
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const n = normalize(raw);
    if (n === null || seen.has(n) || out.length >= limit) return;
    seen.add(n);
    out.push(n);
  };

  push(opts.defaultMultiplier);
  const rounds = sessions.flatMap(s => s.rounds);
  // Date.parse (not string compare) so differing ISO offsets still order correctly.
  rounds.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const r of rounds) push(r.multiplier);
  return out;
}
