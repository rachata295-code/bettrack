import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Currency, Round, RoundResult, Session } from '@/types';
import { CURRENCIES } from '@/types';
import { D, parseMoneyInput } from '@/lib/calculations/money';
import { validateBetInput, type BetInputError } from '@/lib/calculations/round';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';
import { mergeSessions } from '@/lib/io/backup';
import { newId } from '@/lib/id';
import { BETS_KEY, safeStorage } from './storage';

export const DUPLICATE_WINDOW_MS = 300;
const MAX_TAGS = 10;

type SessionInput = Partial<
  Pick<Session, 'name' | 'currency' | 'initialBalance' | 'defaultBet' | 'defaultMultiplier' | 'tags'>
>;

export type RecordResult = { ok: true; round: Round } | { ok: false; errors: BetInputError[] | ['duplicate'] };

interface BetState {
  sessions: Session[];
  activeSessionId: string;
  lastRecordAt: number;
  recordRound: (result: RoundResult, bet: string, multiplier: string) => RecordResult;
  undoLast: () => Round | null;
  restoreRound: (round: Round, index: number) => void;
  editRound: (id: string, patch: Partial<Pick<Round, 'result' | 'bet' | 'multiplier' | 'note'>>) => { ok: boolean };
  deleteRound: (id: string) => void;
  clearSession: (id: string) => void;
  createSession: (input?: SessionInput) => string;
  updateSession: (id: string, patch: SessionInput) => { ok: boolean };
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  importSessions: (incoming: Session[], mode: 'merge' | 'replace') => { added: number; skipped: number };
  resetAll: () => void;
}

function makeSession(name: string, input: SessionInput = {}): Session {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    currency: input.currency ?? 'USDT',
    initialBalance: input.initialBalance ?? '16.99',
    defaultBet: input.defaultBet ?? '4',
    defaultMultiplier: input.defaultMultiplier ?? '2.03',
    rounds: [],
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Validates + normalises a session patch; returns null if anything is invalid. */
function normalizeSessionPatch(patch: SessionInput): SessionInput | null {
  const out: SessionInput = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 1 || name.length > 60) return null;
    out.name = name;
  }
  if (patch.currency !== undefined) {
    if (!CURRENCIES.includes(patch.currency as Currency)) return null;
    out.currency = patch.currency;
  }
  if (patch.initialBalance !== undefined) {
    const p = parseMoneyInput(patch.initialBalance);
    if (!p.ok) return null;
    out.initialBalance = p.value;
  }
  if (patch.defaultBet !== undefined) {
    const p = parseMoneyInput(patch.defaultBet);
    if (!p.ok || !D(p.value).gt(0)) return null;
    out.defaultBet = p.value;
  }
  if (patch.defaultMultiplier !== undefined) {
    const p = parseMoneyInput(patch.defaultMultiplier);
    if (!p.ok || !D(p.value).gt(1)) return null;
    out.defaultMultiplier = p.value;
  }
  if (patch.tags !== undefined) {
    const tags = [...new Set(patch.tags.map(t => t.trim()).filter(Boolean))];
    if (tags.length > MAX_TAGS) return null;
    out.tags = tags;
  }
  return out;
}

const initialState = () => {
  const s = makeSession('Session 1');
  return { sessions: [s], activeSessionId: s.id, lastRecordAt: 0 };
};

export const useBetStore = create<BetState>()(
  persist(
    (set, get) => {
      // Applies fn to one session and bumps updatedAt; no-op (returns false) for unknown ids.
      const mutate = (id: string, fn: (s: Session) => Session): boolean => {
        if (!get().sessions.some(s => s.id === id)) return false;
        const now = new Date().toISOString();
        set(st => ({ sessions: st.sessions.map(s => (s.id === id ? { ...fn(s), updatedAt: now } : s)) }));
        return true;
      };
      const active = () => get().sessions.find(s => s.id === get().activeSessionId);

      return {
        ...initialState(),

        recordRound: (result, bet, multiplier) => {
          const session = active();
          if (!session) return { ok: false, errors: ['no_balance'] };
          const now = Date.now();
          // Guards double-click / held key; rejected attempts must not extend the window.
          if (now - get().lastRecordAt < DUPLICATE_WINDOW_MS) return { ok: false, errors: ['duplicate'] };
          const balance = currentBalance(session.initialBalance, computeTimeline(session.initialBalance, session.rounds));
          const v = validateBetInput({ balance, bet, multiplier });
          if (!v.ok) return { ok: false, errors: v.errors };
          const round: Round = {
            id: newId(),
            result,
            bet: v.bet,
            multiplier: v.multiplier,
            createdAt: new Date(now).toISOString(),
          };
          mutate(session.id, s => ({ ...s, rounds: [...s.rounds, round] }));
          set({ lastRecordAt: now });
          return { ok: true, round };
        },

        undoLast: () => {
          const session = active();
          const last = session?.rounds[session.rounds.length - 1];
          if (!session || !last) return null;
          mutate(session.id, s => ({ ...s, rounds: s.rounds.slice(0, -1) }));
          return last;
        },

        restoreRound: (round, index) => {
          const session = active();
          if (!session) return;
          mutate(session.id, s => {
            const i = Math.min(Math.max(index, 0), s.rounds.length);
            return { ...s, rounds: [...s.rounds.slice(0, i), round, ...s.rounds.slice(i)] };
          });
        },

        editRound: (id, patch) => {
          const session = get().sessions.find(s => s.rounds.some(r => r.id === id));
          if (!session) return { ok: false };
          const out: Partial<Round> = {};
          if (patch.result !== undefined) {
            if (patch.result !== 'win' && patch.result !== 'lose') return { ok: false };
            out.result = patch.result;
          }
          // Format-only validation on purpose: edits may overdraw, the timeline flags those rows.
          if (patch.bet !== undefined) {
            const p = parseMoneyInput(patch.bet);
            if (!p.ok || !D(p.value).gt(0)) return { ok: false };
            out.bet = p.value;
          }
          if (patch.multiplier !== undefined) {
            const p = parseMoneyInput(patch.multiplier);
            if (!p.ok || !D(p.value).gt(1)) return { ok: false };
            out.multiplier = p.value;
          }
          const note = patch.note === undefined ? undefined : patch.note.trim();
          mutate(session.id, s => ({
            ...s,
            rounds: s.rounds.map(r => {
              if (r.id !== id) return r;
              const next: Round = { ...r, ...out };
              if (patch.note !== undefined) {
                if (note) next.note = note;
                else delete next.note;
              }
              return next;
            }),
          }));
          return { ok: true };
        },

        deleteRound: id => {
          const session = get().sessions.find(s => s.rounds.some(r => r.id === id));
          if (session) mutate(session.id, s => ({ ...s, rounds: s.rounds.filter(r => r.id !== id) }));
        },

        clearSession: id => {
          mutate(id, s => ({ ...s, rounds: [] }));
        },

        createSession: input => {
          const norm = input ? normalizeSessionPatch(input) : {};
          // Invalid input falls back to defaults rather than creating a corrupt session.
          const clean = norm ?? {};
          const session = makeSession(clean.name ?? `Session ${get().sessions.length + 1}`, clean);
          set(st => ({ sessions: [...st.sessions, session], activeSessionId: session.id }));
          return session.id;
        },

        updateSession: (id, patch) => {
          const norm = normalizeSessionPatch(patch);
          if (!norm) return { ok: false };
          return { ok: mutate(id, s => ({ ...s, ...norm })) };
        },

        deleteSession: id => {
          const { sessions, activeSessionId } = get();
          if (!sessions.some(s => s.id === id)) return;
          const rest = sessions.filter(s => s.id !== id);
          if (rest.length === 0) {
            const fresh = makeSession('Session 1');
            set({ sessions: [fresh], activeSessionId: fresh.id });
            return;
          }
          set({
            sessions: rest,
            activeSessionId: id === activeSessionId ? rest[rest.length - 1]!.id : activeSessionId,
          });
        },

        setActiveSession: id => {
          if (get().sessions.some(s => s.id === id)) set({ activeSessionId: id });
        },

        importSessions: (incoming, mode) => {
          const { sessions, added, skipped } = mergeSessions(get().sessions, incoming, mode);
          if (sessions.length === 0) return { added, skipped };
          const { activeSessionId } = get();
          set({
            sessions,
            activeSessionId:
              mode === 'replace' || !sessions.some(s => s.id === activeSessionId)
                ? sessions[sessions.length - 1]!.id
                : activeSessionId,
          });
          return { added, skipped };
        },

        resetAll: () => set(initialState()),
      };
    },
    {
      name: BETS_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: false,
      partialize: s => ({ sessions: s.sessions, activeSessionId: s.activeSessionId }),
      migrate: persisted => persisted as BetState,
      // Repair a dangling activeSessionId / empty list so the UI never sees an invalid state.
      merge: (persisted, current) => {
        const p = persisted as Partial<BetState> | undefined;
        if (!p?.sessions || p.sessions.length === 0) return current;
        const activeSessionId = p.sessions.some(s => s.id === p.activeSessionId)
          ? (p.activeSessionId as string)
          : p.sessions[p.sessions.length - 1]!.id;
        return { ...current, sessions: p.sessions, activeSessionId };
      },
    },
  ),
);

