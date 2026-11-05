import type { BucketSummary, PeriodUnit } from '@/lib/calculations/periods';
import type { WalletBuckets } from '@/lib/calculations/wallet';
import { field } from './csv';

const HEADER = 'Period,Rounds,Wins,Losses,WinRatePct,Wagered,Payouts,PnL,ROIPct,MaxDrawdown,Chasing,PlayMinutes';

/** Period summary export. Values are written unrounded so spreadsheets can re-aggregate exactly. */
/** `wallet` adds Deposits,Withdrawals as the last two columns; omit it when wallet totals are not shown. */
export function bucketsToCsv(buckets: readonly BucketSummary[], unit: PeriodUnit, wallet?: WalletBuckets): string {
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
      ...(wallet ? [wallet[b.key]?.deposits ?? '0', wallet[b.key]?.withdrawals ?? '0'] : []),
    ]
      .map(field)
      .join(','),
  );
  // Same BOM + CRLF convention as the history export so Excel opens both identically.
  return '﻿' + [wallet ? `${HEADER},Deposits,Withdrawals` : HEADER, ...rows].join('\r\n') + '\r\n';
}
