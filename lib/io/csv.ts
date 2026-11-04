import type { Session } from '@/types';
import type { TimelineRow } from '@/lib/calculations/timeline';

// RFC 4180: quote fields containing comma, quote or line break; double embedded quotes.
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function historyToCsv(session: Session, timeline: readonly TimelineRow[]): string {
  void session; // kept in the signature for future per-session columns
  const header = 'Round,Result,Bet,Multiplier,ProfitLoss,Balance,Time,Note';
  // Sort by index so round 1 is always first regardless of how the caller ordered rows.
  const rows = [...timeline]
    .sort((x, y) => x.index - y.index)
    .map(r =>
      [
        String(r.index),
        r.round.result === 'win' ? 'Win' : 'Lose',
        r.round.bet,
        r.round.multiplier,
        r.pnl, // unrounded on purpose: exports keep full precision
        r.balanceAfter,
        r.round.createdAt,
        r.round.note ?? '',
      ]
        .map(field)
        .join(','),
    );
  return [header, ...rows].join('\r\n') + '\r\n';
}
