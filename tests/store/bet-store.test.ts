import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDraft, useBetStore } from '@/store/bet-store';
import { clearLoadIssue } from '@/store/storage';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';

const active = () => {
  const s = useBetStore.getState();
  return s.sessions.find(x => x.id === s.activeSessionId)!;
};
const activeRounds = () => active().rounds;
const balanceOfActive = () => currentBalance(active().initialBalance, computeTimeline(active().initialBalance, active().rounds));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  clearLoadIssue();
  vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  useBetStore.getState().resetAll();
  vi.advanceTimersByTime(1000);
});
afterEach(() => vi.useRealTimers());

describe('bet store', () => {
  it('starts with Session 1 using defaults', () => {
    expect(useBetStore.getState().sessions).toHaveLength(1);
    expect(active()).toMatchObject({ name: 'Session 1', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03', currency: 'USDT' });
  });

  it('records win then lose from spec defaults', () => {
    const st = useBetStore.getState();
    expect(st.recordRound('win', '4', '2.03').ok).toBe(true);
    vi.advanceTimersByTime(400);
    expect(st.recordRound('lose', '4', '2.03').ok).toBe(true);
    expect(balanceOfActive()).toBe('17.11');
  });

  it('rejects duplicate within 300ms and keeps lastRecordAt', () => {
    const st = useBetStore.getState();
    st.recordRound('win', '4', '2.03');
    const at = useBetStore.getState().lastRecordAt;
    vi.advanceTimersByTime(100);
    expect(st.recordRound('win', '4', '2.03')).toEqual({ ok: false, errors: ['duplicate'] });
    expect(activeRounds()).toHaveLength(1);
    expect(useBetStore.getState().lastRecordAt).toBe(at);
  });

  it('blocks insufficient balance without touching lastRecordAt', () => {
    expect(useBetStore.getState().recordRound('lose', '17', '2.03')).toMatchObject({ ok: false, errors: ['insufficient_balance'] });
    expect(useBetStore.getState().lastRecordAt).toBe(0);
  });

  it('changing defaults does not touch old rounds', () => {
    const st = useBetStore.getState();
    st.recordRound('win', '4', '2.03');
    expect(st.updateSession(st.activeSessionId, { defaultBet: '10' })).toEqual({ ok: true });
    expect(activeRounds()[0]!.bet).toBe('4');
    expect(active().defaultBet).toBe('10');
  });

  it('undo removes last and restore puts it back', () => {
    const st = useBetStore.getState();
    const sid = st.activeSessionId;
    st.recordRound('win', '4', '2.03');
    vi.advanceTimersByTime(400);
    st.recordRound('lose', '4', '2.03');
    const undone = useBetStore.getState().undoLast();
    if (!undone.ok) throw new Error('setup');
    expect(undone).toMatchObject({ sessionId: sid, index: 1 });
    expect(undone.round.result).toBe('lose');
    expect(balanceOfActive()).toBe('21.11');
    expect(useBetStore.getState().restoreRound(sid, undone.round, undone.index)).toEqual({ ok: true });
    expect(balanceOfActive()).toBe('17.11');
    vi.advanceTimersByTime(400);
    expect(useBetStore.getState().undoLast().ok).toBe(true);
  });

  it('undoLast reports empty on empty session', () => {
    expect(useBetStore.getState().undoLast()).toEqual({ ok: false, reason: 'empty' });
  });

  it('undo double-tap within 300ms removes only one round (I4)', () => {
    const st = useBetStore.getState();
    st.recordRound('win', '4', '2.03');
    vi.advanceTimersByTime(400);
    st.recordRound('win', '4', '2.03');
    expect(useBetStore.getState().undoLast().ok).toBe(true);
    vi.advanceTimersByTime(100);
    expect(useBetStore.getState().undoLast()).toEqual({ ok: false, reason: 'duplicate' });
    expect(activeRounds()).toHaveLength(1);
    vi.advanceTimersByTime(300);
    expect(useBetStore.getState().undoLast().ok).toBe(true);
    expect(activeRounds()).toHaveLength(0);
  });

  it('a clock that moved backwards is not treated as a duplicate', () => {
    const st = useBetStore.getState();
    st.recordRound('win', '4', '2.03');
    vi.setSystemTime(new Date('2026-11-04T09:00:00Z'));
    expect(st.recordRound('win', '4', '2.03').ok).toBe(true);
    expect(useBetStore.getState().undoLast().ok).toBe(true);
    vi.setSystemTime(new Date('2026-11-04T08:00:00Z'));
    expect(useBetStore.getState().undoLast().ok).toBe(true);
  });

  it('restoreRound targets the captured session, not the active one (I7)', () => {
    const st = useBetStore.getState();
    const a = st.activeSessionId;
    st.recordRound('win', '4', '2.03');
    const undone = useBetStore.getState().undoLast();
    if (!undone.ok) throw new Error('setup');
    const b = st.createSession({ name: 'B' });
    expect(useBetStore.getState().restoreRound(a, undone.round, undone.index)).toEqual({ ok: true });
    const s = useBetStore.getState();
    expect(s.activeSessionId).toBe(b);
    expect(s.sessions.find(x => x.id === a)!.rounds.map(r => r.id)).toEqual([undone.round.id]);
    expect(s.sessions.find(x => x.id === b)!.rounds).toHaveLength(0);
  });

  it('restoreRound refuses a missing session, an existing id, or a stale position (I7)', () => {
    const st = useBetStore.getState();
    const a = st.activeSessionId;
    st.recordRound('win', '4', '2.03');
    const undone = useBetStore.getState().undoLast();
    if (!undone.ok) throw new Error('setup');
    expect(useBetStore.getState().restoreRound('gone', undone.round, undone.index)).toEqual({ ok: false, reason: 'no_session' });
    expect(useBetStore.getState().restoreRound(a, undone.round, undone.index)).toEqual({ ok: true });
    expect(useBetStore.getState().restoreRound(a, undone.round, undone.index)).toEqual({ ok: false, reason: 'exists' });
    vi.advanceTimersByTime(400);
    const again = useBetStore.getState().undoLast();
    if (!again.ok) throw new Error('setup');
    vi.advanceTimersByTime(400);
    useBetStore.getState().recordRound('lose', '4', '2.03');
    expect(useBetStore.getState().restoreRound(a, again.round, again.index)).toEqual({ ok: false, reason: 'stale' });
    expect(activeRounds()).toHaveLength(1);
    expect(activeRounds()[0]!.result).toBe('lose');
  });

  it('editRound validates format only and trims note', () => {
    const st = useBetStore.getState();
    const r = st.recordRound('win', '4', '2.03');
    if (!r.ok) throw new Error('setup');
    expect(st.editRound(r.round.id, { bet: 'abc' })).toEqual({ ok: false });
    expect(st.editRound(r.round.id, { multiplier: '1' })).toEqual({ ok: false });
    expect(st.editRound('nope', { bet: '5' })).toEqual({ ok: false });
    expect(activeRounds()[0]!.bet).toBe('4');
    // bet larger than balance is allowed on edit (timeline flags it instead)
    expect(st.editRound(r.round.id, { bet: ' 50 ', note: '  hi  ' })).toEqual({ ok: true });
    expect(activeRounds()[0]).toMatchObject({ bet: '50', note: 'hi' });
    st.editRound(r.round.id, { note: '   ' });
    expect(activeRounds()[0]!.note).toBeUndefined();
  });

  it('deleteRound and clearSession', () => {
    const st = useBetStore.getState();
    const r = st.recordRound('win', '4', '2.03');
    if (!r.ok) throw new Error('setup');
    st.deleteRound(r.round.id);
    expect(activeRounds()).toHaveLength(0);
    vi.advanceTimersByTime(400);
    st.recordRound('win', '4', '2.03');
    st.clearSession(st.activeSessionId);
    expect(activeRounds()).toHaveLength(0);
  });

  it('createSession names, activates; updateSession validates', () => {
    const st = useBetStore.getState();
    const id = st.createSession();
    expect(useBetStore.getState().activeSessionId).toBe(id);
    expect(active().name).toBe('Session 2');
    expect(st.updateSession(id, { name: '   ' })).toEqual({ ok: false });
    expect(st.updateSession(id, { defaultMultiplier: '1' })).toEqual({ ok: false });
    expect(st.updateSession(id, { defaultBet: '0' })).toEqual({ ok: false });
    expect(st.updateSession(id, { name: ' X ', tags: ['a', ' a ', 'b'] })).toEqual({ ok: true });
    expect(active()).toMatchObject({ name: 'X', tags: ['a', 'b'] });
  });

  it('deleting active session falls back; deleting last creates default', () => {
    const st = useBetStore.getState();
    const first = st.activeSessionId;
    const second = st.createSession({ name: 'B' });
    st.deleteSession(second);
    expect(useBetStore.getState().activeSessionId).toBe(first);
    st.deleteSession(first);
    const s = useBetStore.getState();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]!.id).toBe(s.activeSessionId);
  });

  it('setActiveSession ignores unknown ids', () => {
    const st = useBetStore.getState();
    const id = st.activeSessionId;
    st.setActiveSession('nope');
    expect(useBetStore.getState().activeSessionId).toBe(id);
  });

  it('importSessions merge skips existing ids; replace swaps all', () => {
    const st = useBetStore.getState();
    const existing = active();
    const other = { ...existing, id: 'other', name: 'Other' };
    expect(st.importSessions([existing, other], 'merge')).toEqual({ added: 1, skipped: 1 });
    expect(useBetStore.getState().sessions).toHaveLength(2);
    expect(st.importSessions([other], 'replace')).toEqual({ added: 1, skipped: 0 });
    const s = useBetStore.getState();
    expect(s.sessions.map(x => x.id)).toEqual(['other']);
    expect(s.activeSessionId).toBe('other');
  });

  describe('drafts (I1)', () => {
    const draftOf = (id: string) => useBetStore.getState().drafts[id];

    it('falls back to session defaults until edited', () => {
      const st = useBetStore.getState();
      expect(getDraft(useBetStore.getState(), st.activeSessionId)).toEqual({ bet: '4', multiplier: '2.03' });
      expect(draftOf(st.activeSessionId)).toBeUndefined();
    });

    it('stores raw strings per session and keeps the other field', () => {
      const st = useBetStore.getState();
      const a = st.activeSessionId;
      st.setDraft(a, { bet: '8' });
      expect(getDraft(useBetStore.getState(), a)).toEqual({ bet: '8', multiplier: '2.03' });
      st.setDraft(a, { multiplier: '1.9 ' });
      expect(draftOf(a)).toEqual({ bet: '8', multiplier: '1.9 ' });
      const b = st.createSession({ name: 'B', defaultBet: '2' });
      expect(getDraft(useBetStore.getState(), b)).toEqual({ bet: '2', multiplier: '2.03' });
      expect(getDraft(useBetStore.getState(), a).bet).toBe('8');
    });

    it('ignores unknown sessions and is not reset by changing defaults', () => {
      const st = useBetStore.getState();
      st.setDraft('nope', { bet: '9' });
      expect(useBetStore.getState().drafts).toEqual({});
      st.setDraft(st.activeSessionId, { bet: '8' });
      st.updateSession(st.activeSessionId, { defaultBet: '5' });
      expect(getDraft(useBetStore.getState(), st.activeSessionId).bet).toBe('8');
    });

    it('deleting a session drops its draft; resetAll clears all', () => {
      const st = useBetStore.getState();
      const a = st.activeSessionId;
      const b = st.createSession({ name: 'B' });
      st.setDraft(a, { bet: '8' });
      st.setDraft(b, { bet: '3' });
      st.deleteSession(b);
      expect(Object.keys(useBetStore.getState().drafts)).toEqual([a]);
      useBetStore.getState().resetAll();
      expect(useBetStore.getState().drafts).toEqual({});
    });

    it('replace import drops drafts of sessions that no longer exist', () => {
      const st = useBetStore.getState();
      const a = st.activeSessionId;
      st.setDraft(a, { bet: '8' });
      const other = { ...active(), id: 'other', name: 'Other' };
      st.importSessions([other], 'replace');
      expect(useBetStore.getState().drafts).toEqual({});
    });
  });
});

