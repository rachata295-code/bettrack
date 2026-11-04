'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { currentLossStreak, evaluateSessionLimits, wouldChase, type LimitHitDetail } from '@/lib/calculations/guard';
import type { RoundResult } from '@/types';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useRecordRound } from './use-record-round';

export const CHASING_MESSAGE = 'Bet raised right after a loss — consider sticking to your plan.';

export interface PendingRecord {
  result: RoundResult;
  hits: LimitHitDetail[];
  sessionId: string;
}

/**
 * The only record path for WIN/LOSE buttons and W/L shortcuts. Wraps useRecordRound with the
 * Bankroll Guard: cooldown blocks recording, a reached limit asks for confirmation every time,
 * and after saving it may warn about chasing or start a hard break. It never changes the bet.
 */
export function useGuardedRecord(
  bet: string,
  multiplier: string,
): {
  record: (result: RoundResult) => void;
  undo: () => void;
  locked: boolean;
  pending: PendingRecord | null;
  confirm: () => void;
  cancel: () => void;
} {
  const inner = useRecordRound(bet, multiplier);
  const innerRecord = inner.record;
  const [pending, setPending] = useState<PendingRecord | null>(null);

  // Saves the round and runs the post-record guard checks. Always reads a fresh store snapshot.
  const commit = useCallback(
    (result: RoundResult) => {
      const { guard } = useSettingsStore.getState();
      const st = useBetStore.getState();
      const before = st.sessions.find(s => s.id === st.activeSessionId)?.rounds ?? [];
      const saved = innerRecord(result);
      if (!saved) return;
      if (guard.chasingAlert && wouldChase(before, saved.bet)) toast.warning(CHASING_MESSAGE);
      const { lossStreak } = guard;
      if (result === 'lose' && lossStreak.enabled && lossStreak.mode === 'hard') {
        const after = useBetStore.getState();
        const rounds = after.sessions.find(s => s.id === after.activeSessionId)?.rounds ?? [];
        if (currentLossStreak(rounds) >= lossStreak.n) after.startCooldown(lossStreak.cooldownMin);
      }
    },
    [innerRecord],
  );

  const record = useCallback(
    (result: RoundResult) => {
      // A dialog already open means the user has not answered yet; extra taps/keys are ignored.
      if (pending) return;
      const st = useBetStore.getState();
      if (st.cooldownUntil !== null && Date.now() < st.cooldownUntil) return;
      const session = st.sessions.find(s => s.id === st.activeSessionId);
      if (!session) return;
      const { guard } = useSettingsStore.getState();
      const hits = evaluateSessionLimits({ session, sessions: st.sessions, dailyLossLimit: guard.dailyLossLimit, now: new Date() });
      if (hits.length > 0) {
        setPending({ result, hits, sessionId: session.id });
        return;
      }
      commit(result);
    },
    [pending, commit],
  );

  const confirm = useCallback(() => {
    if (!pending) return;
    setPending(null);
    // Re-check what may have changed while the dialog was open (another tab): a break that started
    // still wins, and a switched session must not receive a round confirmed for a different one.
    const { cooldownUntil, activeSessionId } = useBetStore.getState();
    if (cooldownUntil !== null && Date.now() < cooldownUntil) return;
    if (activeSessionId !== pending.sessionId) return;
    commit(pending.result);
  }, [pending, commit]);

  const cancel = useCallback(() => setPending(null), []);

  return { record, undo: inner.undo, locked: inner.locked, pending, confirm, cancel };
}
