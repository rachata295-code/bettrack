'use client';

import { Info, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BetSuggestion } from '@/lib/calculations/guard';
import { formatMoney, formatPercent } from '@/lib/calculations/money';
import type { Money } from '@/types';

/** A suggestion only: the bet changes solely when the user taps "Use". */
export function SuggestedBet({
  suggestion,
  percent,
  precision,
  currency,
  onUse,
}: {
  suggestion: BetSuggestion;
  percent: string;
  precision: number;
  currency: string;
  onUse: (value: Money) => void;
}) {
  // Capped means the only "suggestion" left would be the whole balance — never offer an all-in as advice.
  if (suggestion.reason === 'capped') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden />
        Balance is below your minimum bet.
      </p>
    );
  }
  // The label states the real share: a bump to minBet means more than the configured percent.
  const basis =
    suggestion.reason === 'min'
      ? `minimum bet — ${formatPercent(suggestion.pctOfBalance, 0)} of balance`
      : `${percent}% of balance`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
      <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Lightbulb className="size-4 shrink-0" aria-hidden />
        <span>
          Suggested <span className="num font-medium text-foreground">{formatMoney(suggestion.amount, { precision })}</span>{' '}
          {currency} ({basis})
        </span>
      </p>
      <Button size="sm" variant="outline" onClick={() => onUse(suggestion.amount)}>
        Use
      </Button>
    </div>
  );
}
