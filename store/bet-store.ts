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
export type UndoResult =
  | { ok: true; sessionId: string; round: Round; index: number }
  | { ok: false; reason: 'empty' | 'duplicate' };
export type RestoreResult = { ok: true } | { ok: false; reason: 'no_session' | 'exists' | 'stale' };

/** Calculator inputs exactly as typed (may be invalid mid-edit), kept per session. */
export interface Draft {
  bet: string;
  multiplier: string;
}
const MAX_DRAFT_LEN = 64;

// Inside the window only for a forward clock step: a clock moved backwards must not block input forever.
const isDuplicate = (now: number, last: number): boolean => now - last >= 0 && now - last < DUPLICATE_WINDOW_MS;

interface BetState {
  sessions: Session[];
  activeSessionId: string;
  lastRecordAt: number;
  lastUndoAt: number;
  drafts: Record<string, Draft>;
  recordRound: (result: RoundResult, bet: string, multiplier: string) => RecordResult;
  undoLast: () => UndoResult;
  restoreRound: (sessionId: string, round: Round, index: number) => RestoreResult;
  setDraft: (sessionId: string, patch: Partial<Draft>) => void;
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
  return { sessions: [s], activeSessionId: s.id, lastRecordAt: 0, lastUndoAt: 0, drafts: {} as Record<string, Draft> };
};

/** The Calculator/Dashboard inputs for a session: the saved draft, else the session defaults. */
export function getDraft(state: Pick<BetState, 'sessions' | 'drafts'>, sessionId: string): Draft {
  const d = state.drafts[sessionId];
  const s = state.sessions.find(x => x.id === sessionId);
  return { bet: d?.bet ?? s?.defaultBet ?? '', multiplier: d?.multiplier ?? s?.defaultMultiplier ?? '' };
}

const isDraftField = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_DRAFT_LEN;

/** Lenient: drafts are a convenience, so bad entries are dropped instead of blocking the app. */
function sanitizeDrafts(raw: unknown, sessions: readonly Session[]): Record<string, Draft> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, Draft> = {};
  for (const s of sessions) {
    const d = (raw as Record<string, unknown>)[s.id] as Partial<Record<keyof Draft, unknown>> | undefined;
    if (d && typeof d === 'object' && isDraftField(d.bet) && isDraftField(d.multiplier)) {
      out[s.id] = { bet: d.bet, multiplier: d.multiplier };
    }
  }
  return out;
}

const pruneDrafts = (drafts: Record<string, Draft>, sessions: readonly Session[]): Record<string, Draft> =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => sessions.some(s => s.id === id)));

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
          if (isDuplicate(now, get().lastRecordAt)) return { ok: false, errors: ['duplicate'] };
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
          if (!session || !last) return { ok: false, reason: 'empty' };
          const now = Date.now();
          // Same guard as recordRound: a double-tap on Undo must not remove two rounds.
          if (isDuplicate(now, get().lastUndoAt)) return { ok: false, reason: 'duplicate' };
          mutate(session.id, s => ({ ...s, rounds: s.rounds.slice(0, -1) }));
          set({ lastUndoAt: now });
          return { ok: true, sessionId: session.id, round: last, index: session.rounds.length - 1 };
        },

        restoreRound: (sessionId, round, index) => {
          const session = get().sessions.find(s => s.id === sessionId);
          if (!session) return { ok: false, reason: 'no_session' };
          if (session.rounds.some(r => r.id === round.id)) return { ok: false, reason: 'exists' };
          // Undo only removes the last round, so redo is valid only while the session is still that length;
          // otherwise a round recorded/deleted since would be reordered around the restored one.
          if (session.rounds.length !== index) return { ok: false, reason: 'stale' };
          mutate(sessionId, s => ({ ...s, rounds: [...s.rounds, round] }));
          return { ok: true };
        },

        setDraft: (sessionId, patch) => {
          if (!get().sessions.some(s => s.id === sessionId)) return;
          set(st => {
            const cur = getDraft(st, sessionId);
            return { drafts: { ...st.drafts, [sessionId]: { ...cur, ...patch } } };
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
            set({ sessions: [fresh], activeSessionId: fresh.id, drafts: {} });
            return;
          }
          set({
            sessions: rest,
            drafts: pruneDrafts(get().drafts, rest),
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
            drafts: pruneDrafts(get().drafts, sessions),
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
      partialize: s => ({ sessions: s.sessions, activeSessionId: s.activeSessionId, drafts: s.drafts }),
      migrate: persisted => persisted as BetState,
      // Repair a dangling activeSessionId / empty list so the UI never sees an invalid state.
      merge: (persisted, current) => {
        const p = persisted as Partial<BetState> | undefined;
        if (!p?.sessions || p.sessions.length === 0) return current;
        const activeSessionId = p.sessions.some(s => s.id === p.activeSessionId)
          ? (p.activeSessionId as string)
          : p.sessions[p.sessions.length - 1]!.id;
        return { ...current, sessions: p.sessions, activeSessionId, drafts: sanitizeDrafts(p.drafts, p.sessions) };
      },
    },
  ),
);

