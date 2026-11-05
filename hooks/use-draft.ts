'use client';

import { useCallback } from 'react';
import { getDraft, useBetStore } from '@/store/bet-store';

/**
 * Per-session bet/multiplier as typed, persisted in the bet store so Calculator and the
 * Dashboard quick buttons always use the same values (PLAN §3.3 rule 6) across navigation/refresh.
 */
export function useDraft(sessionId: string): {
  bet: string;
  multiplier: string;
  setBet: (v: string) => void;
  setMultiplier: (v: string) => void;
} {
  // Two primitive selectors: returning a fresh object would re-render on every store change.
  const bet = useBetStore(s => getDraft(s, sessionId).bet);
  const multiplier = useBetStore(s => getDraft(s, sessionId).multiplier);
  const setBet = useCallback((v: string) => useBetStore.getState().setDraft(sessionId, { bet: v }), [sessionId]);
  const setMultiplier = useCallback(
    (v: string) => useBetStore.getState().setDraft(sessionId, { multiplier: v }),
    [sessionId],
  );
  return { bet, multiplier, setBet, setMultiplier };
}
