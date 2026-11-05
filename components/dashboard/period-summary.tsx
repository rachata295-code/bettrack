'use client';

import { useMemo } from 'react';
import { formatMoney } from '@/lib/calculations/money';
import { collectRows, comparePeriods, type PeriodUnit } from '@/lib/calculations/periods';
import { cn } from '@/lib/utils';
import type { Currency, Session } from '@/types';

const TITLES: Record<Extract<PeriodUnit, 'day' | 'week'>, string> = { day: 'Today', week: 'This week' };

/** Today / This week P&L across every session of the active currency (currencies never mix). */
export function PeriodSummary({
  sessions,
  currency,
  precision,
}: {
  sessions: readonly Session[];
  currency: Currency;
  precision: number;
}) {
  const cards = useMemo(() => {
    const rows = collectRows(sessions, { currency });
    const now = new Date();
    return (['day', 'week'] as const).map(unit => ({ unit, current: comparePeriods(rows, unit, now).current }));
  }, [sessions, currency]);
  return (
    <section aria-label="Period summaries" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map(({ unit, current }) => {
        const pnl = formatMoney(current.pnl, { precision, signed: true });
        return (
          <div key={unit} className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="text-xs text-muted-foreground">
              {TITLES[unit]} · all {currency} sessions
            </div>
            <div
              className={cn(
                'num mt-1 truncate text-xl font-semibold',
                pnl.startsWith('+') ? 'text-profit' : pnl.startsWith('−') ? 'text-loss' : '',
              )}
            >
              {pnl} {currency}
            </div>
            <div className="num text-xs text-muted-foreground">
              {current.rounds} {current.rounds === 1 ? 'round' : 'rounds'}
            </div>
          </div>
        );
      })}
    </section>
  );
}
