'use client';

import { formatMoney, formatPercent } from '@/lib/calculations/money';
import { compareDeltas } from '@/lib/calculations/period-format';
import type { BucketSummary, PeriodUnit } from '@/lib/calculations/periods';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types';

const TITLES: Record<PeriodUnit, { cur: string; prev: string }> = {
  day: { cur: 'Today', prev: 'yesterday' },
  week: { cur: 'This week', prev: 'last week' },
  month: { cur: 'This month', prev: 'last month' },
};

function tone(text: string): string {
  if (text.startsWith('+')) return 'text-profit';
  if (text.startsWith('−')) return 'text-loss';
  return 'text-muted-foreground';
}

interface Props {
  current: BucketSummary;
  previous: BucketSummary;
  unit: PeriodUnit;
  currency: Currency;
  precision: number;
}

export function CompareCards({ current, previous, unit, currency, precision }: Props) {
  const t = TITLES[unit];
  const d = compareDeltas(current, previous, precision);
  const pnlCur = formatMoney(current.pnl, { precision, signed: true });
  const cards = [
    {
      label: 'P&L',
      value: `${pnlCur} ${currency}`,
      valueTone: tone(pnlCur),
      prev: `${formatMoney(previous.pnl, { precision, signed: true })} ${currency}`,
      delta: `${d.pnlText} ${currency}`,
    },
    { label: 'Rounds', value: String(current.rounds), valueTone: '', prev: String(previous.rounds), delta: d.roundsText },
    {
      label: 'Win rate',
      value: current.rounds ? formatPercent(current.winRatePct, 1) : '—',
      valueTone: '',
      prev: previous.rounds ? formatPercent(previous.winRatePct, 1) : '—',
      delta: d.winRateText ?? '—',
    },
  ];
  return (
    <section aria-label={`${t.cur} compared with ${t.prev}`} className="space-y-2">
      <h2 className="text-lg font-semibold">{t.cur} <span className="text-sm font-normal text-muted-foreground">vs {t.prev}</span></h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={cn('num truncate text-xl font-semibold', c.valueTone)}>{c.value}</div>
            <div className="num mt-1 flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
              <span>Prev: {c.prev}</span>
              {/* Delta is plain signed text; colour would read as "better/worse", which a count is not. */}
              <span><span className="sr-only">Change: </span>Δ {c.delta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
