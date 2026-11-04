'use client';

import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/calculations/money';
import type { Money } from '@/types';

/** A suggestion only: the bet changes solely when the user taps "Use". */
export function SuggestedBet({
  suggested,
  percent,
  precision,
  currency,
  onUse,
}: {
  suggested: Money;
  percent: string;
  precision: number;
  currency: string;
  onUse: (value: Money) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Lightbulb className="size-4 shrink-0" aria-hidden />
        <span>
          Suggested <span className="num font-medium text-foreground">{formatMoney(suggested, { precision })}</span>{' '}
          {currency} ({percent}% of balance)
        </span>
      </p>
      <Button size="sm" variant="outline" onClick={() => onUse(suggested)}>
        Use
      </Button>
    </div>
  );
}
