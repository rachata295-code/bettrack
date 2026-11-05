'use client';

import { useBetStore } from '@/store/bet-store';
import type { Session } from '@/types';

export function useActiveSession(): Session {
  // The store guarantees activeSessionId points at an existing session; fall back to the first just in case.
  return useBetStore(s => s.sessions.find(x => x.id === s.activeSessionId) ?? s.sessions[0]!);
}
