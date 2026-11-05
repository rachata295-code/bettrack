import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Transaction } from '@/types';
import { validateTransaction } from '@/lib/calculations/wallet';
import { newId } from '@/lib/id';
import { WALLET_KEY, safeStorage } from './storage';

type Errors = Record<string, string>;

interface WalletState {
  transactions: Transaction[];
  addTransaction: (input: Omit<Transaction, 'id'>) => { ok: true; id: string } | { ok: false; errors: Errors };
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => { ok: boolean; errors?: Errors };
  deleteTransaction: (id: string) => void;
  importTransactions: (incoming: Transaction[], mode: 'merge' | 'replace') => { added: number; skipped: number };
  resetAll: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      transactions: [],
      addTransaction: input => {
        const v = validateTransaction(input);
        if (!v.ok) return v;
        const id = newId();
        set({ transactions: [...get().transactions, { id, ...v.value }] });
        return { ok: true, id };
      },
      updateTransaction: (id, patch) => {
        const cur = get().transactions.find(t => t.id === id);
        if (!cur) return { ok: false, errors: { _: 'Transaction not found' } };
        // Validate the merged result so a patch can never leave an invalid record.
        const v = validateTransaction({ ...cur, id: undefined, ...patch });
        if (!v.ok) return { ok: false, errors: v.errors };
        set({ transactions: get().transactions.map(t => (t.id === id ? { id, ...v.value } : t)) });
        return { ok: true };
      },
      deleteTransaction: id => set({ transactions: get().transactions.filter(t => t.id !== id) }),
      importTransactions: (incoming, mode) => {
        if (mode === 'replace') {
          set({ transactions: [...incoming] });
          return { added: incoming.length, skipped: 0 };
        }
        const ids = new Set(get().transactions.map(t => t.id));
        const next = [...get().transactions];
        let added = 0;
        let skipped = 0;
        for (const t of incoming) {
          if (ids.has(t.id)) skipped++;
          else {
            ids.add(t.id);
            next.push(t);
            added++;
          }
        }
        set({ transactions: next });
        return { added, skipped };
      },
      resetAll: () => set({ transactions: [] }),
    }),
    {
      name: WALLET_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: s => ({ transactions: s.transactions }),
      migrate: persisted => persisted as WalletState,
      // storage.validate already guarantees a valid array; this only guards the shape.
      merge: (persisted, current) => {
        const p = persisted as Partial<WalletState> | undefined;
        return { ...current, transactions: Array.isArray(p?.transactions) ? p.transactions : [] };
      },
    },
  ),
);
