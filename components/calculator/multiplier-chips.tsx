'use client';

import { D, parseMoneyInput } from '@/lib/calculations/money';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  defaultMultiplier: string;
  options: string[];
  onPick: (m: string) => void;
}

/** One-tap multiplier picker; picking only fills the field, it never records a round. */
export function MultiplierChips({ value, options, onPick }: Props) {
  const parsed = parseMoneyInput(value);
  // Compare by Decimal so "2.0" in the field still highlights the "2" chip; unparseable = nothing active.
  const isActive = (m: string) => parsed.ok && D(parsed.value).eq(D(m));

  if (options.length === 0) return null;
  return (
    <div role="group" aria-label="Quick multipliers" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {options.map((m, i) => {
        const active = isActive(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(m)}
            className={cn(
              'num flex min-h-10 shrink-0 flex-col items-center justify-center rounded-lg border px-3 text-sm font-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'border-accent bg-accent/15 text-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{m}x</span>
            {i === 0 && <span className="text-[10px] font-normal leading-none text-muted-foreground">Default</span>}
          </button>
        );
      })}
    </div>
  );
}
