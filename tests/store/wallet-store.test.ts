import { beforeEach, describe, expect, it } from 'vitest';
import { useWalletStore } from '@/store/wallet-store';
import { useBetStore } from '@/store/bet-store';
import { clearLoadIssue, getLoadIssues, WALLET_KEY } from '@/store/storage';
import { createBackup, parseBackup } from '@/lib/io/backup';
import { startStorageSync } from '@/store/sync';
import type { Transaction } from '@/types';

const base = { type: 'deposit' as const, amount: '100', currency: 'USDT' as const, fee: '0', at: '2026-11-04T10:00:00.000Z' };
const T = (id: string): Transaction => ({ ...base, id });

beforeEach(() => {
  localStorage.clear();
  clearLoadIssue();
  useWalletStore.getState().resetAll();
});

describe('wallet store', () => {
  it('adds with validation', () => {
    const bad = useWalletStore.getState().addTransaction({ ...base, amount: '0' });
    expect(bad.ok).toBe(false);
    expect(useWalletStore.getState().transactions).toHaveLength(0);
    const r = useWalletStore.getState().addTransaction(base);
    expect(r.ok).toBe(true);
    expect(useWalletStore.getState().transactions).toHaveLength(1);
  });
  it('updates, rejecting invalid patches', () => {
    const r = useWalletStore.getState().addTransaction(base);
    if (!r.ok) throw new Error();
    expect(useWalletStore.getState().updateTransaction(r.id, { fee: '2' })).toEqual({ ok: true });
    expect(useWalletStore.getState().transactions[0]!.fee).toBe('2');
    const bad = useWalletStore.getState().updateTransaction(r.id, { amount: '-1' });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveProperty('amount');
    expect(useWalletStore.getState().transactions[0]!.amount).toBe('100');
    expect(useWalletStore.getState().updateTransaction('nope', { fee: '1' }).ok).toBe(false);
  });
  it('deletes', () => {
    const r = useWalletStore.getState().addTransaction(base);
    if (!r.ok) throw new Error();
    useWalletStore.getState().deleteTransaction(r.id);
    expect(useWalletStore.getState().transactions).toHaveLength(0);
  });
  it('imports merge and replace', () => {
    useWalletStore.getState().importTransactions([T('a'), T('b')], 'merge');
    expect(useWalletStore.getState().importTransactions([T('b'), T('c')], 'merge')).toEqual({ added: 1, skipped: 1 });
    expect(useWalletStore.getState().transactions.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect(useWalletStore.getState().importTransactions([T('z')], 'replace')).toEqual({ added: 1, skipped: 0 });
    expect(useWalletStore.getState().transactions.map(t => t.id)).toEqual(['z']);
  });
  it('persists and rehydrates', async () => {
    useWalletStore.getState().importTransactions([T('a')], 'merge');
    const snap = localStorage.getItem(WALLET_KEY)!;
    expect(snap).toContain('"transactions"');
    useWalletStore.getState().resetAll();
    localStorage.setItem(WALLET_KEY, snap);
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().transactions.map(t => t.id)).toEqual(['a']);
  });
  it('normalises lenient stored dates', async () => {
    localStorage.setItem(WALLET_KEY, JSON.stringify({ state: { transactions: [{ ...T('a'), at: '2026-11-04 10:00:00Z' }] }, version: 1 }));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().transactions[0]!.at).toBe('2026-11-04T10:00:00.000Z');
    expect(getLoadIssues()).toEqual([]);
  });
  it.each([['broken json', '{broken'], ['bad amount', JSON.stringify({ state: { transactions: [{ ...T('a'), amount: '-5' }] }, version: 1 })]])(
    'corrupt wallet (%s) sets loadIssue and is never overwritten', async (_n, raw) => {
      localStorage.setItem(WALLET_KEY, raw);
      await useWalletStore.persist.rehydrate();
      expect(getLoadIssues().map(i => i.key)).toEqual([WALLET_KEY]);
      useWalletStore.getState().addTransaction(base);
      expect(localStorage.getItem(WALLET_KEY)).toBe(raw);
    });
  it('rehydrates on a storage event', () => {
    const stop = startStorageSync();
    localStorage.setItem(WALLET_KEY, JSON.stringify({ state: { transactions: [T('x')] }, version: 1 }));
    window.dispatchEvent(new StorageEvent('storage', { key: WALLET_KEY }));
    stop();
    expect(useWalletStore.getState().transactions.map(t => t.id)).toEqual(['x']);
  });
});

describe('backup transactions', () => {
  it('M2 backup without transactions parses', () => {
    const b = JSON.parse(JSON.stringify(createBackup(useBetStore.getState().sessions)));
    expect('transactions' in b).toBe(false);
    const p = parseBackup(JSON.stringify(b));
    expect(p.ok && p.backup.transactions).toBeUndefined();
  });
  it('round-trips transactions', () => {
    const b = createBackup(useBetStore.getState().sessions, undefined, [{ ...T('a'), note: 'n' }]);
    const p = parseBackup(JSON.stringify(b));
    expect(p.ok && p.backup.transactions).toEqual([{ ...T('a'), note: 'n' }]);
  });
  it('rejects invalid transactions in a file', () => {
    const b = createBackup(useBetStore.getState().sessions, undefined, [{ ...T('a'), amount: '0' }]);
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false);
    const b2 = createBackup(useBetStore.getState().sessions, undefined, [{ ...T('a'), at: '1' }]);
    expect(parseBackup(JSON.stringify(b2)).ok).toBe(false);
  });
});
