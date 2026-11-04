'use client';

import { useMemo } from 'react';
import type { Money, Session } from '@/types';
import { computeSessionStats, type SessionStats } from '@/lib/calculations/stats';
import { computeTimeline, currentBalance, type TimelineRow } from '@/lib/calculations/timeline';
import { useActiveSession } from './use-active-session';

export function useTimeline(): { session: Session; timeline: TimelineRow[]; stats: SessionStats; balance: Money } {
  const session = useActiveSession();
  const { rounds, initialBalance } = session;
  // Keyed on rounds/initialBalance only, so renaming a session does not recompute everything.
  const derived = useMemo(() => {
    const timeline = computeTimeline(initialBalance, rounds);
    return {
      timeline,
      stats: computeSessionStats(initialBalance, timeline),
      balance: currentBalance(initialBalance, timeline),
    };
  }, [rounds, initialBalance]);
  return { session, ...derived };
}
