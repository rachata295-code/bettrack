'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney, formatPercent } from '@/lib/calculations/money';
import { formatPlayTime, formatSignedPercent, periodLabel, sortBuckets, type BucketSortKey } from '@/lib/calculations/period-format';
import type { BucketSummary, PeriodUnit } from '@/lib/calculations/periods';
import { downloadText } from '@/lib/io/download';
import { summaryFilename } from '@/lib/io/filename';
import type { WalletBuckets } from '@/lib/calculations/wallet';
import { bucketsToCsv } from '@/lib/io/period-csv';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types';

const COLUMNS: { key: BucketSortKey; label: string; numeric: boolean }[] = [
  { key: 'period', label: 'Period', numeric: false },
  { key: 'rounds', label: 'Rounds', numeric: true },
  { key: 'wl', label: 'W/L', numeric: true },
  { key: 'winRate', label: 'Win rate', numeric: true },
  { key: 'wagered', label: 'Wagered', numeric: true },
  { key: 'pnl', label: 'P&L', numeric: true },
  { key: 'roi', label: 'ROI', numeric: true },
  { key: 'maxDd', label: 'Max DD', numeric: true },
  { key: 'chasing', label: 'Chasing', numeric: true },
  { key: 'playTime', label: 'Play time', numeric: true },
];

function tone(signedText: string): string {
  return signedText.startsWith('+') ? 'text-profit' : signedText.startsWith('−') ? 'text-loss' : '';
}

export function PeriodTable({
  buckets, unit, precision, currency, wallet = null, walletMissingRates = [],
}: {
  buckets: readonly BucketSummary[];
  unit: PeriodUnit;
  precision: number;
  /** Currency the wallet columns were converted to (shown in their headers). */
  currency: Currency;
  /** Deposits/withdrawals per bucket key (already converted in lib); null hides the columns. */
  wallet?: WalletBuckets | null;
  /** Currencies with no exchange rate set; non-empty hides the wallet columns. */
  walletMissingRates?: readonly Currency[];
}) {
  // Newest period first: that is what people look for after a session.
  const [sort, setSort] = useState<{ key: BucketSortKey; dir: 'asc' | 'desc' }>({ key: 'period', dir: 'desc' });
  const sorted = useMemo(() => sortBuckets(buckets, sort.key, sort.dir), [buckets, sort]);

  const toggle = (key: BucketSortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const exportCsv = () => {
    try {
      // Export keeps chronological order (not the on-screen sort) so the file is ready to chart.
      downloadText(summaryFilename(unit), bucketsToCsv(buckets, unit, wallet ?? undefined), 'text/csv;charset=utf-8');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <section aria-label="Period summary" className="min-w-0 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Summary</h2>
        <Button variant="outline" onClick={exportCsv} className="min-h-11">
          <Download /> Export CSV
        </Button>
      </div>
      {walletMissingRates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Wallet totals hidden: set an exchange rate in <Link href="/settings" className="underline underline-offset-2">Settings</Link> to convert {walletMissingRates.join(', ')} to {currency}.
        </p>
      )}
      {wallet && (
        // Wallet transactions are not tied to a session or the filters, so say so instead of implying they are.
        <p className="text-xs text-muted-foreground">
          Wallet totals include every session; periods without rounds aren&apos;t listed — see <Link href="/wallet" className="underline underline-offset-2">Wallet</Link> for full totals.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(c => {
              const active = sort.key === c.key;
              return (
                <TableHead
                  key={c.key}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(c.numeric && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn('inline-flex min-h-9 items-center gap-1 whitespace-nowrap hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', active && 'text-foreground')}
                  >
                    {c.label}
                    {active && (sort.dir === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
                  </button>
                </TableHead>
              );
            })}
            {wallet && (
              <>
                <TableHead className="text-right whitespace-nowrap">Deposits (all sessions, {currency})</TableHead>
                <TableHead className="text-right whitespace-nowrap">Withdrawals (all sessions, {currency})</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(b => {
            const pnl = formatMoney(b.pnl, { precision, signed: true });
            const roi = formatSignedPercent(b.roiPct, 1);
            return (
              <TableRow key={b.key}>
                <TableCell className="num whitespace-nowrap font-medium">{periodLabel(b.key, unit)}</TableCell>
                <TableCell className="num text-right">{b.rounds}</TableCell>
                <TableCell className="num text-right whitespace-nowrap">{b.wins}/{b.losses}</TableCell>
                <TableCell className="num text-right">{formatPercent(b.winRatePct, 1)}</TableCell>
                <TableCell className="num text-right">{formatMoney(b.wagered, { precision })}</TableCell>
                <TableCell className={cn('num text-right font-medium', tone(pnl))}>{pnl}</TableCell>
                <TableCell className={cn('num text-right', tone(roi))}>{roi}</TableCell>
                <TableCell className="num text-right">{formatMoney(b.maxDrawdown, { precision })}</TableCell>
                <TableCell className="num text-right">{b.chasing}</TableCell>
                <TableCell className="num text-right whitespace-nowrap">{formatPlayTime(b.playMinutes)}</TableCell>
                {wallet && (
                  <>
                    <TableCell className="num text-right">{formatMoney(wallet[b.key]?.deposits ?? '0', { precision })}</TableCell>
                    <TableCell className="num text-right">{formatMoney(wallet[b.key]?.withdrawals ?? '0', { precision })}</TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
