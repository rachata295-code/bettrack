'use client';

import { AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/calculations/money';
import type { TimelineRow } from '@/lib/calculations/timeline';
import { cn } from '@/lib/utils';
import { INSUFFICIENT_TEXT, ResultBadge } from './result-badge';
import { RoundActions } from './round-actions';

export function HistoryTable({ rows, precision }: { rows: TimelineRow[]; precision: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Round</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Bet</TableHead>
          <TableHead className="text-right">Multiplier</TableHead>
          <TableHead className="text-right">P&amp;L</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => {
          const win = r.round.result === 'win';
          return (
            <TableRow key={r.round.id} className={cn(r.insufficient && 'bg-loss/10')}>
              <TableCell className="num">
                <span className="inline-flex items-center gap-1.5">
                  #{r.index}
                  {r.insufficient && (
                    <span title={INSUFFICIENT_TEXT} className="text-loss">
                      <AlertTriangle className="size-4" aria-hidden />
                      <span className="sr-only">{INSUFFICIENT_TEXT}</span>
                    </span>
                  )}
                </span>
                {r.round.note && <span className="block max-w-48 truncate text-xs text-muted-foreground" title={r.round.note}>{r.round.note}</span>}
              </TableCell>
              <TableCell><ResultBadge result={r.round.result} /></TableCell>
              <TableCell className="num text-right">{formatMoney(r.round.bet, { precision })}</TableCell>
              <TableCell className="num text-right">×{r.round.multiplier}</TableCell>
              <TableCell className={cn('num text-right', win ? 'text-profit' : 'text-loss')}>
                {formatMoney(r.pnl, { precision, signed: true })}
              </TableCell>
              <TableCell className="num text-right">{formatMoney(r.balanceAfter, { precision })}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(r.round.createdAt).toLocaleString()}</TableCell>
              <TableCell><RoundActions row={r} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
