'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/calculations/money';
import { formatPlayTime } from '@/lib/calculations/period-format';
import { dateKey } from '@/lib/calculations/periods';
import { realityState, sessionTodayPnl } from '@/lib/calculations/reality-check';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useBangkokDayKey } from './use-bangkok-day-key';

const CHECK_EVERY_MS = 30_000;

export interface RealityCheckView {
  open: boolean;
  elapsedText: string;
  pnlText: string;
  sessionName: string;
  takeBreak: () => void;
  keepPlaying: () => void;
}

/**
 * Responsible-play reminder: opens every `intervalMin` minutes of ACTIVE play today (gaps > 15 min
 * between rounds don't count) for the active session, and only while the user is still playing
 * (latest round within `intervalMin` of now) — never hours later after they stopped (R19). Answering either button acks the current
 * interval, so it only reappears at the next one.
 */
export function useRealityCheck(): RealityCheckView {
  const session = useBetStore(s => s.sessions.find(x => x.id === s.activeSessionId) ?? s.sessions[0]!);
  const ack = useBetStore(s => s.realityAck);
  const { enabled, intervalMin } = useSettingsStore(s => s.realityCheck);
  const precision = useSettingsStore(s => s.precision);
  const cooldownMin = useSettingsStore(s => s.guard.lossStreak.cooldownMin);
  const dayKey = useBangkokDayKey();

  const [now, setNow] = useState(() => new Date());
  // One interval for the whole lifetime; a backgrounded phone tab catches up on the next tick.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, []);
  // Re-evaluate right away when a round is recorded/edited or the day rolls over: adjusting state
  // during render (instead of in an effect) avoids an extra stale paint.
  const [seen, setSeen] = useState({ rounds: session.rounds, dayKey });
  if (seen.rounds !== session.rounds || seen.dayKey !== dayKey) {
    setSeen({ rounds: session.rounds, dayKey });
    setNow(new Date());
  }

  const state = useMemo(() => realityState(session.rounds, now, intervalMin), [session.rounds, now, intervalMin]);
  const day = dateKey(now.toISOString());
  const acked = !!ack && ack.sessionId === session.id && ack.day === day && !!state && ack.index >= state.dueIndex;
  const open = enabled && !!state && state.playing && state.dueIndex >= 1 && !acked;

  const dueIndex = state?.dueIndex ?? 0;
  const ackNow = useCallback(
    () => useBetStore.getState().ackReality(session.id, day, dueIndex),
    [session.id, day, dueIndex],
  );

  return {
    open,
    elapsedText: formatPlayTime(state?.activeMin ?? 0),
    pnlText: formatMoney(sessionTodayPnl(session, now), { precision, currency: session.currency, signed: true }),
    sessionName: session.name,
    takeBreak: () => {
      useBetStore.getState().startCooldown(cooldownMin);
      ackNow();
    },
    keepPlaying: ackNow,
  };
}
