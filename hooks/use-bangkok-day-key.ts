'use client';

import { useEffect, useState } from 'react';
import { dateKey, msUntilNextBangkokMidnight } from '@/lib/calculations/periods';

/**
 * Current Bangkok date key ("2026-11-05"). Use it as a memo dependency for anything derived from
 * "now" (today / this week), so a page left open across midnight rolls over on its own.
 */
export function useBangkokDayKey(): string {
  const [key, setKey] = useState(() => dateKey(new Date().toISOString()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // setKey with an unchanged string is a no-op re-render, so refreshing eagerly is cheap.
    const refresh = () => setKey(dateKey(new Date().toISOString()));
    const schedule = () => {
      // +1 s so the timer never lands a hair before midnight due to clock drift.
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextBangkokMidnight(new Date()) + 1000);
    };
    // Background tabs throttle/suspend timers (phones especially); re-check when shown again.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      refresh();
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return key;
}
