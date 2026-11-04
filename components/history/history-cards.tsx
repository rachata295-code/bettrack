'use client';

import { AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/lib/calculations/money';
import type { TimelineRow } from '@/lib/calculations/timeline';
import { cn } from '@/lib/utils';
import { INSUFFICIENT_TEXT, ResultBadge } from './result-badge';
import { RoundActions } from './round-actions';

export function HistoryCards({ rows, precision }: { rows: TimelineRow[]; precision: number }) {
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.round.id} className={cn('rounded-xl border border-border bg-surface p-3', r.insufficient && 'bg-loss/10')}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="num font-medium">#{r.index}</span>
              <ResultBadge result={r.round.result} />
              {r.insufficient && (
                <span className="inline-flex items-center gap-1 text-xs text-loss">
                  <AlertTriangle className="size-4" aria-hidden />
                  {INSUFFICIENT_TEXT}
                </span>
              )}
            </div>
            <span className={cn('num font-medium', r.round.result === 'win' ? 'text-profit' : 'text-loss')}>
              {formatMoney(r.pnl, { precision, signed: true })}
            </span>
          </div>
          <dl className="num mt-2 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">Bet</dt><dd>{formatMoney(r.round.bet, { precision })}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Multiplier</dt><dd>×{r.round.multiplier}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Balance</dt><dd>{formatMoney(r.balanceAfter, { precision })}</dd></div>
          </dl>
          {r.round.note && <p className="mt-2 text-sm text-muted-foreground">{r.round.note}</p>}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{new Date(r.round.createdAt).toLocaleString()}</span>
            <RoundActions row={r} />
          </div>
        </li>
      ))}
    </ul>
  );
}
