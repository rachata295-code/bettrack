import { describe, expect, it } from 'vitest';
import { createBackup, mergeSessions, parseBackup, sessionToJson } from '@/lib/io/backup';
import type { Session } from '@/types';

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
});
