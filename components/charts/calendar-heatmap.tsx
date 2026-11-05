'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dayCellLabel, heatLevel, monthGrid, monthLabel, monthMaxAbs, shiftMonth } from '@/lib/calculations/calendar';
import type { BucketSummary } from '@/lib/calculations/periods';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Static class strings so Tailwind can see them; index = |level| (1..4).
const PROFIT = ['', 'bg-profit/20', 'bg-profit/40', 'bg-profit/65', 'bg-profit/90 text-black'];
const LOSS = ['', 'bg-loss/20', 'bg-loss/40', 'bg-loss/65', 'bg-loss/90 text-black'];

interface Props {
  month: string; // yyyy-MM
  onMonthChange: (m: string) => void;
  dayBuckets: readonly BucketSummary[];
  currency: Currency;
  precision: number;
  onSelectDay: (key: string) => void;
}

export function CalendarHeatmap({ month, onMonthChange, dayBuckets, currency, precision, onSelectDay }: Props) {
  const byDay = useMemo(() => new Map(dayBuckets.map(b => [b.key, b])), [dayBuckets]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const maxAbs = useMemo(() => monthMaxAbs(dayBuckets, month), [dayBuckets, month]);

  return (
    <section aria-label="Calendar" className="min-w-0 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" aria-live="polite">{monthLabel(month)}</h2>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-lg" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden>
        {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="space-y-1">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((key, di) => {
              if (!key) return <div key={`pad-${di}`} aria-hidden />;
              const b = byDay.get(key);
              const has = !!b && b.rounds > 0;
              const level = has ? heatLevel(b.pnl, maxAbs) : 0;
              const day = Number(key.slice(8));
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!has}
                  aria-label={dayCellLabel(key, b, currency, precision)}
                  onClick={() => onSelectDay(key)}
                  className={cn(
                    'num flex aspect-square min-h-10 flex-col items-center justify-center rounded-md text-sm leading-tight transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    !has && 'cursor-default bg-muted/30 text-muted-foreground/60',
                    has && level === 0 && 'bg-muted ring-1 ring-border',
                    level > 0 && PROFIT[level],
                    level < 0 && LOSS[-level],
                  )}
                >
                  <span>{day}</span>
                  {/* Sign glyph so profit vs loss never relies on colour alone. */}
                  {has && <span aria-hidden className="text-[10px] font-semibold">{level > 0 ? '+' : level < 0 ? '−' : '0'}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Shade compares each day with the biggest daily result this month. The calendar ignores the date range.
      </p>
    </section>
  );
}
