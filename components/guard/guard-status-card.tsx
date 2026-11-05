'use client';

import { Timer } from 'lucide-react';
import { RiskBadge } from '@/components/guard/risk-badge';
import { formatMoney } from '@/lib/calculations/money';
import { formatCountdown, formatLimitProgress, type LimitProgress } from '@/lib/calculations/guard';
import type { GuardView } from '@/hooks/use-guard';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types';

/**
 * At-a-glance guard state for the Dashboard. Descriptive only: it reports your own settings and
 * records, and says nothing about what the next round will do.
 */
export function GuardStatusCard({
  guard,
  precision,
  currency,
}: {
  guard: Pick<GuardView, 'suggested' | 'risk' | 'lossStreak' | 'cooldownRemainingMs' | 'progress'>;
  precision: number;
  currency: Currency;
}) {
  const { suggested, risk, lossStreak, cooldownRemainingMs, progress } = guard;
  return (
    <section aria-label="Bankroll guard status" className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold">Bankroll guard</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <Row label="Suggested bet">
          {suggested === null
            ? '—'
            : suggested.reason === 'capped'
              ? 'Below minimum bet'
              : `${formatMoney(suggested.amount, { precision })} ${currency}`}
        </Row>
        <Row label="Risk of current bet">{risk ? <RiskBadge pct={risk.pct} level={risk.level} /> : '—'}</Row>
        <Row label="Loss streak">{lossStreak}</Row>
        <Row label="Break">
          {cooldownRemainingMs > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-4" aria-hidden />
              {formatCountdown(cooldownRemainingMs)} left
            </span>
          ) : (
            'None'
          )}
        </Row>
      </dl>
      {progress.length > 0 && (
        <ul aria-label="Limit progress" className="space-y-1 border-t border-border pt-3 text-sm">
          {progress.map(p => (
            <LimitRow key={p.hit} p={p} precision={precision} currency={currency} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num mt-1 font-medium">{children}</dd>
    </div>
  );
}

function LimitRow({ p, precision, currency }: { p: LimitProgress; precision: number; currency: Currency }) {
  return (
    <li className={cn('num flex flex-wrap items-center gap-x-2', p.reached ? 'font-medium text-loss' : 'text-muted-foreground')}>
      <span>{formatLimitProgress(p, precision, currency)}</span>
      {/* Text, not colour alone, marks a reached limit. */}
      {p.reached && <span>· Limit reached</span>}
    </li>
  );
}
