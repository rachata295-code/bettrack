'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  currentLossStreak, evaluateSessionLimits, evaluateSessionProgress, riskBand, suggestedBet,
  type LimitHit, type LimitHitDetail, type LimitProgress, type RiskLevel,
} from '@/lib/calculations/guard';
import { parseMoneyInput } from '@/lib/calculations/money';
import type { Money } from '@/types';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTimeline } from './use-timeline';

export interface GuardView {
  suggested: Money | null;
  /** pct is full precision; format at display time. */
  risk: { pct: string; level: RiskLevel } | null;
  lossStreak: number;
  /** Streak reached the configured n and the streak alert is enabled. */
  streakAlert: boolean;
  /** Ticks every second while > 0; 0 when no break is running. */
  cooldownRemainingMs: number;
  /** Limits that are currently reached (used by GuardStatusCard-adjacent consumers and tests). */
  hits: LimitHit[];
  limitDetails: LimitHitDetail[];
  /** One row per limit that is set, with used/limit amounts for the status card. */
  progress: LimitProgress[];
}

/** Ticking "now" only while a cooldown is running, so idle pages do not re-render every second. */
function useCooldownRemaining(cooldownUntil: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  // Re-sync `now` in the same store update that starts/changes a break (this tab or a synced one),
  // so a long-open page never renders a countdown from its stale mount time.
  useEffect(
    () =>
      useBetStore.subscribe((s, prev) => {
        if (s.cooldownUntil !== prev.cooldownUntil) setNow(Date.now());
      }),
    [],
  );
  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // Stop once expired: the final tick renders 0, which unlocks the buttons without a refresh.
      if (t >= cooldownUntil) clearInterval(id);
    };
    // tick only ever runs asynchronously, after `id` below is initialised.
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);
  return cooldownUntil === null ? 0 : Math.max(0, cooldownUntil - now);
}

/** Read-only guard view for the active session. Advice only — it never changes the bet. */
export function useGuard(bet: string): GuardView {
  const { session, balance } = useTimeline();
  const guard = useSettingsStore(s => s.guard);
  const precision = useSettingsStore(s => s.precision);
  const sessions = useBetStore(s => s.sessions);
  const cooldownUntil = useBetStore(s => s.cooldownUntil);
  const cooldownRemainingMs = useCooldownRemaining(cooldownUntil);

  const suggested = useMemo(() => suggestedBet(balance, guard.sizing, precision), [balance, guard.sizing, precision]);

  const parsedBet = parseMoneyInput(bet);
  const betValue = parsedBet.ok ? parsedBet.value : null;
  const risk = useMemo(
    () => (betValue === null ? null : riskBand(betValue, balance, guard.riskBands)),
    [betValue, balance, guard.riskBands],
  );

  const lossStreak = useMemo(() => currentLossStreak(session.rounds), [session.rounds]);
  const { enabled, n } = guard.lossStreak;

  // Display-only; recording re-checks against a fresh store snapshot at click time.
  const limitDetails = useMemo(
    () => evaluateSessionLimits({ session, sessions, dailyLossLimit: guard.dailyLossLimit, now: new Date() }),
    [session, sessions, guard.dailyLossLimit],
  );

  const progress = useMemo(
    () => evaluateSessionProgress({ session, sessions, dailyLossLimit: guard.dailyLossLimit, now: new Date() }),
    [session, sessions, guard.dailyLossLimit],
  );

  return {
    suggested,
    risk,
    lossStreak,
    streakAlert: enabled && lossStreak >= n,
    cooldownRemainingMs,
    hits: limitDetails.map(d => d.hit),
    limitDetails,
    progress,
  };
}
