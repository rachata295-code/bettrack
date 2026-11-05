import type { BucketSummary, PeriodUnit } from '@/lib/calculations/periods';
import { field } from './csv';

const HEADER = 'Period,Rounds,Wins,Losses,WinRatePct,Wagered,Payouts,PnL,ROIPct,MaxDrawdown,Chasing,PlayMinutes';

/** Period summary export. Values are written unrounded so spreadsheets can re-aggregate exactly. */
export function bucketsToCsv(buckets: readonly BucketSummary[], unit: PeriodUnit): string {
  void unit; // the key already encodes the unit (2026-11-04 / 2026-W45 / 2026-11); kept for callers' clarity
  const rows = buckets.map(b =>
    [
      b.key,
      String(b.rounds),
      String(b.wins),
      String(b.losses),
      b.winRatePct,
      b.wagered,
      b.payouts,
      b.pnl,
      b.roiPct,
      b.maxDrawdown,
      String(b.chasing),
      String(b.playMinutes),
    ]
      .map(field)
      .join(','),
  );
  // Same BOM + CRLF convention as the history export so Excel opens both identically.
  return '﻿' + [HEADER, ...rows].join('\r\n') + '\r\n';
}
