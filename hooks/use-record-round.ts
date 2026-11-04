'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { RoundResult } from '@/types';
import { D, formatMoney } from '@/lib/calculations/money';
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
        toast.error(
          `LOSE ${formatMoney(D(p.lose.loss).neg().toString(), { precision, signed: true })} → ${formatMoney(p.lose.newBalance, { precision })}`,
        );
      }
    },
    [bet, multiplier],
  );

  const undo = useCallback(() => {
    const st = useBetStore.getState();
    const session = st.sessions.find(s => s.id === st.activeSessionId);
    // restoreRound takes the 0-based position, which for the last round is length - 1.
    const index = (session?.rounds.length ?? 0) - 1;
    const removed = st.undoLast();
    if (!removed) {
      toast('Nothing to undo');
      return;
    }
    toast(`Undid ${removed.result.toUpperCase()} round`, {
      action: { label: 'Redo', onClick: () => useBetStore.getState().restoreRound(removed, index) },
    });
  }, []);

  return { record, undo, locked };
}
