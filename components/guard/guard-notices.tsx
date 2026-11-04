'use client';

import { useState } from 'react';
import { CooldownPanel } from './cooldown-panel';
import { StreakBanner } from './streak-banner';

/**
 * Break countdown (hard mode) or the dismissible streak banner. Shared by Calculator and Dashboard
 * so both record surfaces show the same guard state.
 */
export function GuardNotices({
  streakAlert,
  lossStreak,
  cooldownRemainingMs,
}: {
  streakAlert: boolean;
  lossStreak: number;
  cooldownRemainingMs: number;
}) {
  // Keyed by streak length: dismissing hides it only until the streak grows (the next loss).
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  if (cooldownRemainingMs > 0) return <CooldownPanel remainingMs={cooldownRemainingMs} />;
  if (streakAlert && dismissedAt !== lossStreak) {
    return <StreakBanner streak={lossStreak} onDismiss={() => setDismissedAt(lossStreak)} />;
  }
  return null;
}
