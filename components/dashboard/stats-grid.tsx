import type { Currency } from '@/types';
import { D, formatMoney, formatPercent } from '@/lib/calculations/money';
import type { SessionStats } from '@/lib/calculations/stats';
import { cn } from '@/lib/utils';

function tone(v: string): string {
  const d = D(v);
  return d.isZero() ? '' : d.isPositive() ? 'text-profit' : 'text-loss';
}

export function formatStreak(streak: SessionStats['streak']): string {
  if (!streak.type || streak.count === 0) return '—';
  return `${streak.count} ${streak.type === 'win' ? 'W' : 'L'}`;
}

export function StatsGrid({ stats, currency, precision }: { stats: SessionStats; currency: Currency; precision: number }) {
  const money = (v: string) => formatMoney(v, { precision, currency });
  const signed = (v: string) => formatMoney(v, { precision, currency, signed: true });
  const items: { label: string; value: string; className?: string }[] = [
    { label: 'Total rounds', value: String(stats.rounds) },
    { label: 'Wins', value: String(stats.wins) },
    { label: 'Losses', value: String(stats.losses) },
    { label: 'Win rate', value: formatPercent(stats.winRatePct, 1) },
    { label: 'Wagered', value: money(stats.wagered) },
    { label: 'Payouts', value: money(stats.payouts) },
    { label: 'Avg P&L / round', value: signed(stats.avgPnl), className: tone(stats.avgPnl) },
    { label: 'Largest win', value: signed(stats.largestWin), className: tone(stats.largestWin) },
    // Stored as a positive magnitude, so negate for display to get the minus sign.
    {
      label: 'Largest loss',
      value: signed(D(stats.largestLoss).neg().toString()),
      className: tone(D(stats.largestLoss).neg().toString()),
    },
    { label: 'Current streak', value: formatStreak(stats.streak) },
    {
      label: 'Max drawdown',
      value: `${money(stats.maxDrawdown)} (${formatPercent(stats.maxDrawdownPct, 1)})`,
    },
  ];
  return (
    <section aria-label="Session statistics">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(i => (
          <div key={i.label} className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd className={cn('num mt-1 break-words text-lg font-semibold', i.className)}>{i.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
