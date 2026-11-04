import { z } from 'zod';
import { CURRENCIES } from '@/types';
import type { Session, Settings } from '@/types';
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

export const RoundSchema = z.object({
  id: z.string().min(1),
  result: z.enum(['win', 'lose']),
  bet: positive,
  multiplier,
  createdAt: isoDate,
  note: z.string().optional(),
});

// Default zod behaviour strips unknown keys, so export-only fields like currentBalance are ignored on import.
export const SessionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  currency: z.enum(CURRENCIES as [Session['currency'], ...Session['currency'][]]),
  initialBalance: nonNegative,
  defaultBet: positive,
  defaultMultiplier: multiplier,
  rounds: z.array(RoundSchema),
  tags: z.array(z.string()),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const BackupSchema = z.object({
  app: z.literal('bettrack'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: isoDate,
  sessions: z.array(SessionSchema),
  settings: z.object({ precision: z.number().int().min(0).max(8) }).optional(),
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
