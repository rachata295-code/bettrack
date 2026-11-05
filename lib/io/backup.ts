import { z } from 'zod';
import { CURRENCIES } from '@/types';
import type { Session, Settings } from '@/types';
import { parseGuardSettings, validateLimitValue } from '@/lib/calculations/guard';
import { DEFAULT_FEES, validateFeesPatch, validateFxPatch } from '@/lib/calculations/fx';
import { D, isPositive, parseMoneyInput } from '@/lib/calculations/money';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';

export const BACKUP_VERSION = 1;

// Plain decimal string only (no surrounding whitespace, signs or exponents), so stored data stays canonical.
const decimalString = z.string().refine(s => s === s.trim() && parseMoneyInput(s).ok, 'invalid decimal string');
const nonNegative = decimalString;
const positive = decimalString.refine(isPositive, 'must be > 0');
const multiplier = decimalString.refine(s => D(s).gt(1), 'must be > 1');
// Strict ISO 8601 with offset: lenient strings like "1" would parse but break period bucketing.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const isoDate = z.string().regex(ISO_RE, 'invalid date').refine(s => !Number.isNaN(Date.parse(s)), 'invalid date');
// Persisted-load only: M1 builds could store looser (but parseable) dates; reject them and an upgraded
// user would land on the recovery screen. Accept anything Date.parse understands and normalise to ISO.
const lenientDate = z
  .string()
  .refine(s => !Number.isNaN(Date.parse(s)), 'invalid date')
  .transform(s => new Date(s).toISOString());

type DateSchema = typeof isoDate | typeof lenientDate;

const roundSchema = (date: DateSchema) =>
  z.object({
    id: z.string().min(1),
    result: z.enum(['win', 'lose']),
    bet: positive,
    multiplier,
    createdAt: date,
    note: z.string().optional(),
  });

export const RoundSchema = roundSchema(isoDate);

const limitValue = z
  .object({ kind: z.enum(['amount', 'percent']), value: z.string() })
  .refine(v => validateLimitValue(v) !== null, 'invalid limit')
  .transform(v => validateLimitValue(v)!);
const sessionGuard = z.object({ stopLoss: limitValue.optional(), takeProfit: limitValue.optional() });
// Transform (not just refine) so import stores the normalised guard, never raw untrusted strings.
const guardSettings = z.unknown().transform((v, ctx) => {
  const g = parseGuardSettings(v);
  if (!g) {
    ctx.addIssue({ code: 'custom', message: 'invalid guard settings' });
    return z.NEVER;
  }
  return g;
});

// Strict like guard: normalised values only, invalid input rejects the file.
const fxSettings = z.unknown().transform((v, ctx) => {
  const r = typeof v === 'object' && v !== null && !Array.isArray(v) ? validateFxPatch(v as object) : null;
  if (!r || !r.ok) {
    ctx.addIssue({ code: 'custom', message: 'invalid exchange rates' });
    return z.NEVER;
  }
  return r.value;
});
const feeSettings = z.unknown().transform((v, ctx) => {
  const complete =
    typeof v === 'object' && v !== null && (Object.keys(DEFAULT_FEES) as string[]).every(k => k in (v as object));
  const r = complete ? validateFeesPatch(DEFAULT_FEES, v as object) : null;
  if (!r || !r.ok) {
    ctx.addIssue({ code: 'custom', message: 'invalid fee settings' });
    return z.NEVER;
  }
  return r.value;
});
const realityCheckSettings = z.object({ enabled: z.boolean(), intervalMin: z.number().int().min(1).max(1440) });

// Default zod behaviour strips unknown keys, so export-only fields like currentBalance are ignored on import.
const sessionSchema = (date: DateSchema) =>
  z.object({
    id: z.string().min(1),
    name: z.string(),
    currency: z.enum(CURRENCIES as [Session['currency'], ...Session['currency'][]]),
    initialBalance: nonNegative,
    defaultBet: positive,
    defaultMultiplier: multiplier,
    rounds: z.array(roundSchema(date)),
    tags: z.array(z.string()),
    guard: sessionGuard.optional(),
    createdAt: date,
    updatedAt: date,
  });

/** Strict: file import (untrusted input) requires canonical ISO 8601 dates. */
export const SessionSchema = sessionSchema(isoDate);
/** Lenient dates, normalised to ISO: only for reading this app's own localStorage. */
export const StoredSessionSchema = sessionSchema(lenientDate);

export const BackupSchema = z.object({
  app: z.literal('bettrack'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: isoDate,
  sessions: z.array(SessionSchema),
  settings: z
    .object({
      precision: z.number().int().min(0).max(8),
      guard: guardSettings.optional(),
      // Optional so M1/M2 backups (no fx/fees/realityCheck) still parse.
      fx: fxSettings.optional(),
      fees: feeSettings.optional(),
      realityCheck: realityCheckSettings.optional(),
    })
    .optional(),
});

export interface Backup {
  app: 'bettrack';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  settings?: Settings;
}

export function createBackup(sessions: Session[], settings?: Settings): Backup {
  // currentBalance is a convenience for humans reading the file; it is never trusted on import.
  const withBalance = sessions.map(s => ({
    ...s,
    currentBalance: currentBalance(s.initialBalance, computeTimeline(s.initialBalance, s.rounds)),
  }));
  return {
    app: 'bettrack',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: withBalance,
    ...(settings ? { settings } : {}),
  };
}

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    return { ok: false, error: `Not a valid BetTrack backup${where}: ${issue?.message ?? 'unknown error'}` };
  }
  return { ok: true, backup: result.data as Backup };
}

export function mergeSessions(
  existing: Session[],
  incoming: Session[],
  mode: 'merge' | 'replace',
): { sessions: Session[]; added: number; skipped: number } {
  if (mode === 'replace') return { sessions: [...incoming], added: incoming.length, skipped: 0 };
  const ids = new Set(existing.map(s => s.id));
  const sessions = [...existing];
  let added = 0;
  let skipped = 0;
  for (const s of incoming) {
    if (ids.has(s.id)) {
      skipped++;
    } else {
      ids.add(s.id);
      sessions.push(s);
      added++;
    }
  }
  return { sessions, added, skipped };
}

export function sessionToJson(session: Session): string {
  return JSON.stringify(createBackup([session]), null, 2);
}
