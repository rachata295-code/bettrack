import { describe, expect, it } from 'vitest';
import { createBackup, mergeSessions, parseBackup, sessionToJson } from '@/lib/io/backup';
import type { Session } from '@/types';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';

const mkSession = (id: string): Session => ({
  id, name: `S ${id}`, currency: 'USDT', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03',
  rounds: [{ id: `r-${id}`, result: 'win', bet: '4', multiplier: '2.03', createdAt: '2026-11-04T10:00:00.000Z', note: 'n' }],
  tags: ['x'], createdAt: '2026-11-04T09:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
});
const session = mkSession('s1');
const a = mkSession('a');
const c = mkSession('c');

describe('backup', () => {
  it('round-trips and drops currentBalance', () => {
    const b = createBackup([session]);
    expect(b.sessions[0]).toHaveProperty('currentBalance', '21.11');
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed).toEqual({ ok: true, backup: expect.objectContaining({ sessions: [session] }) });
  });
  it('keeps settings', () => {
    const p = parseBackup(JSON.stringify(createBackup([session], { precision: 4 })));
    expect(p.ok && p.backup.settings).toEqual({ precision: 4 });
  });
  it('parses M1 backups that have no guard anywhere', () => {
    const b = JSON.parse(JSON.stringify(createBackup([session], { precision: 3 })));
    expect(parseBackup(JSON.stringify(b)).ok).toBe(true);
  });
  it('round-trips session guard and settings.guard', () => {
    const guarded: Session = { ...session, guard: { stopLoss: { kind: 'amount', value: '5' }, takeProfit: { kind: 'percent', value: '50' } } };
    const g = { ...DEFAULT_GUARD, dailyLossLimit: '10' };
    const p = parseBackup(JSON.stringify(createBackup([guarded], { precision: 2, guard: g })));
    expect(p.ok && p.backup.sessions[0]!.guard).toEqual(guarded.guard);
    expect(p.ok && p.backup.settings).toEqual({ precision: 2, guard: g });
  });
  it('rejects invalid session guard limits', () => {
    for (const guard of [
      { stopLoss: { kind: 'percent', value: '101' } },
      { stopLoss: { kind: 'amount', value: '0' } },
      { takeProfit: { kind: 'weird', value: '1' } },
    ]) {
      expect(parseBackup(JSON.stringify({ ...createBackup([session]), sessions: [{ ...session, guard }] })).ok).toBe(false);
    }
  });
  it('round-trips settings.fx / fees / realityCheck and still parses older backups', () => {
    const settings = {
      precision: 2,
      fx: { usdtThb: '35.5' },
      fees: { cryptoWithdrawFee: '1', tradeFeePct: '0.1', spreadPct: '0.5', thbWithdrawFee: '20' },
      realityCheck: { enabled: true, intervalMin: 30 },
    };
    const p = parseBackup(JSON.stringify(createBackup([], settings)));
    expect(p.ok && p.backup.settings).toEqual(settings);
  });

  it('rejects invalid settings.fx / fees', () => {
    const mk = (settings: object) => JSON.stringify({ ...createBackup([]), settings });
    expect(parseBackup(mk({ precision: 2, fx: { usdtThb: '-1' } })).ok).toBe(false);
    expect(parseBackup(mk({ precision: 2, fees: { tradeFeePct: '5' } })).ok).toBe(false);
  });

  it('rejects invalid settings.guard', () => {
    const b = createBackup([session], { precision: 2, guard: { ...DEFAULT_GUARD, sizing: { mode: 'percent', percent: '0', minBet: '1' } } });
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false);
  });
  it('rejects bad input without throwing', () => {
    const b = createBackup([session]);
    expect(parseBackup('{not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...b, version: 2 })).ok).toBe(false);
    const bad = (patch: object) => parseBackup(JSON.stringify({ ...b, sessions: [{ ...session, ...patch }] })).ok;
    expect(bad({ initialBalance: '-1' })).toBe(false);
    expect(bad({ initialBalance: '1e3' })).toBe(false);
    expect(bad({ defaultBet: '0' })).toBe(false);
    expect(bad({ defaultMultiplier: '1' })).toBe(false);
    expect(bad({ currency: 'EUR' })).toBe(false);
    expect(bad({ rounds: [{ ...session.rounds[0], multiplier: '0.5' }] })).toBe(false);
    expect(bad({ rounds: [{ ...session.rounds[0], result: 'draw' }] })).toBe(false);
  });
  it('sessionToJson wraps a single session in a valid backup', () => {
    const p = parseBackup(sessionToJson(session));
    expect(p.ok && p.backup.sessions).toEqual([session]);
  });
});

describe('mergeSessions', () => {
  it('merge skips duplicate ids', () => {
    const r = mergeSessions([a], [a, c], 'merge');
    expect(r).toMatchObject({ added: 1, skipped: 1 });
    expect(r.sessions.map(s => s.id)).toEqual(['a', 'c']);
  });
  it('replace swaps everything', () => {
    expect(mergeSessions([a], [c], 'replace').sessions).toEqual([c]);
  });

  it('rejects lenient dates in backup', () => {
    const bad = (v: string) => JSON.stringify({ ...createBackup([session]), exportedAt: v });
    for (const v of ['1', '2026-11-04', 'Nov 4 2026', '2026-13-45T10:00:00Z', '2026-11-04T10:00:00']) {
      expect(parseBackup(bad(v)).ok).toBe(false);
    }
    expect(parseBackup(bad('2026-11-04T10:00:00+07:00')).ok).toBe(true);
  });
});
