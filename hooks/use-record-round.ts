'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { RoundResult } from '@/types';
import { formatMoney, negate } from '@/lib/calculations/money';
import { BET_ERROR_MESSAGES, previewRound } from '@/lib/calculations/round';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

const LOCK_MS = 300;

export function useRecordRound(
  bet: string,
  multiplier: string,
): { record: (result: RoundResult) => void; undo: () => void; locked: boolean } {
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const record = useCallback(
    (result: RoundResult) => {
      const { precision } = useSettingsStore.getState();
      const st = useBetStore.getState();
      const session = st.sessions.find(s => s.id === st.activeSessionId);
      // Balance before the round, so the toast can show the same numbers the preview showed.
      const before = session
        ? currentBalance(session.initialBalance, computeTimeline(session.initialBalance, session.rounds))
        : '0';
      const res = st.recordRound(result, bet, multiplier);
      if (!res.ok) {
        // Duplicate (double-click / held key) is intentionally silent.
        if (res.errors[0] === 'duplicate') return;
        for (const err of res.errors as (keyof typeof BET_ERROR_MESSAGES)[]) toast.error(BET_ERROR_MESSAGES[err]);
        return;
      }
      setLocked(true);
      timer.current = setTimeout(() => setLocked(false), LOCK_MS);
      const p = previewRound(before, res.round.bet, res.round.multiplier);
      if (result === 'win') {
        toast.success(
          `WIN ${formatMoney(p.win.profit, { precision, signed: true })} → ${formatMoney(p.win.newBalance, { precision })}`,
        );
      } else {
        // Plain toast: a loss is a normal outcome being recorded, not an app error.
        toast(
          `LOSE ${formatMoney(negate(p.lose.loss), { precision, signed: true })} → ${formatMoney(p.lose.newBalance, { precision })}`,
        );
      }
    },
    [bet, multiplier],
  );

  const undo = useCallback(() => {
    const res = useBetStore.getState().undoLast();
    if (!res.ok) {
      // Duplicate (double-tap on Undo) is intentionally silent, like record.
      if (res.reason === 'empty') toast('Nothing to undo');
      return;
    }
    const { sessionId, round, index } = res;
    // Remember the round now last so redo can tell a delete+record since the undo (same length, new tail).
    const tailId = useBetStore.getState().sessions.find(s => s.id === sessionId)?.rounds.at(-1)?.id;
    toast(`Undid ${round.result.toUpperCase()} round`, {
      action: {
        label: 'Redo',
        onClick: () => {
          const st = useBetStore.getState();
          const session = st.sessions.find(s => s.id === sessionId);
          if (session && session.rounds.at(-1)?.id !== tailId) {
            toast("Can't redo — the session changed since the undo");
            return;
          }
          const r = st.restoreRound(sessionId, round, index);
          if (!r.ok) {
            const why = {
              no_session: 'that session was deleted',
              exists: 'the round is already back',
              stale: 'the session changed since the undo',
            }[r.reason];
            toast(`Can't redo — ${why}`);
          }
        },
      },
    });
  }, []);

  return { record, undo, locked };
}
