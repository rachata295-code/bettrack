import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBetStore } from '@/store/bet-store';
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
    st.recordRound('win', '4', '2.03');
    vi.advanceTimersByTime(400);
    st.recordRound('lose', '4', '2.03');
    const undone = useBetStore.getState().undoLast();
    expect(undone?.result).toBe('lose');
    expect(balanceOfActive()).toBe('21.11');
    useBetStore.getState().restoreRound(undone!, 1);
    expect(balanceOfActive()).toBe('17.11');
    expect(useBetStore.getState().undoLast()).not.toBeNull();
  });

  it('undoLast returns null on empty session', () => {
    expect(useBetStore.getState().undoLast()).toBeNull();
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
});
