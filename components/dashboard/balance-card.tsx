import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { Currency } from '@/types';
import { D, formatMoney, formatPercent } from '@/lib/calculations/money';
import type { SessionStats } from '@/lib/calculations/stats';
import { cn } from '@/lib/utils';

function pnlClass(value: string): string {
  const d = D(value);
  return d.isZero() ? 'text-muted-foreground' : d.isPositive() ? 'text-profit' : 'text-loss';
}

export function BalanceCard({
  stats,
  currency,
  precision,
  hasInsufficient,
}: {
  stats: SessionStats;
  currency: Currency;
  precision: number;
  hasInsufficient: boolean;
}) {
  const money = (v: string) => formatMoney(v, { precision, currency });
  // Sign is always rendered with +/− so meaning never depends on colour alone.
  const roiSigned = `${D(stats.roiPct).isPositive() && !D(stats.roiPct).isZero() ? '+' : D(stats.roiPct).isNegative() ? '−' : ''}${formatPercent(D(stats.roiPct).abs().toString(), 2)}`;

  return (
    <section aria-label="Balance" className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <p className="text-sm text-muted-foreground">Current balance</p>
        <p className="num text-4xl font-semibold sm:text-5xl" data-testid="current-balance">
          {money(stats.current)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5">
        <Item label="Initial" value={money(stats.initial)} />
        <Item
          label="Net P&L"
          value={formatMoney(stats.netPnl, { precision, currency, signed: true })}
          className={pnlClass(stats.netPnl)}
        />
        <Item label="ROI" value={roiSigned} className={pnlClass(stats.roiPct)} />
        <Item label="Highest" value={money(stats.highest)} />
        <Item label="Lowest" value={money(stats.lowest)} />
      </dl>
      {hasInsufficient && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Some rounds exceed the balance available at that time —{' '}
            <Link href="/history" className="underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
              review History
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

function Item({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('num font-medium', className)}>{value}</dd>
    </div>
  );
}
