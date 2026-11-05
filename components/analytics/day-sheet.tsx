'use client';

import { useMemo } from 'react';
import { ResultBadge } from '@/components/history/result-badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { dayLabel } from '@/lib/calculations/calendar';
import { formatMoney } from '@/lib/calculations/money';
import { timeInTz } from '@/lib/calculations/period-format';
import { dateKey, summarize, type AnalyticsRow } from '@/lib/calculations/periods';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types';

interface Props {
  day: string | null;
  onClose: () => void;
  rows: readonly AnalyticsRow[];
  currency: Currency;
  precision: number;
}

export function DaySheet({ day, onClose, rows, currency, precision }: Props) {
  const dayRows = useMemo(() => (day ? rows.filter(r => dateKey(r.round.createdAt) === day) : []), [day, rows]);
  const total = useMemo(() => summarize(day ?? '', dayRows), [day, dayRows]);

  return (
    <Sheet open={day !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85dvh]">
        <SheetHeader className="pr-12">
          <SheetTitle>{day ? dayLabel(day) : ''}</SheetTitle>
          <SheetDescription className="num">
            {dayRows.length} {dayRows.length === 1 ? 'round' : 'rounds'} · {formatMoney(total.pnl, { precision, signed: true, currency })} · times in Bangkok
          </SheetDescription>
        </SheetHeader>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-4 pb-8">
          {dayRows.map(r => (
            <li key={`${r.sessionId}-${r.round.id}`} className="flex items-center gap-3 py-2.5">
              <span className="num w-12 shrink-0 text-muted-foreground">{timeInTz(r.round.createdAt)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.sessionName}</div>
                <div className="num text-xs text-muted-foreground">
                  Bet {formatMoney(r.round.bet, { precision })} · ×{r.round.multiplier}
                </div>
              </div>
              <ResultBadge result={r.round.result} />
              <span className={cn('num w-20 shrink-0 text-right font-medium', r.round.result === 'win' ? 'text-profit' : 'text-loss')}>
                {formatMoney(r.pnl, { precision, signed: true })}
              </span>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
