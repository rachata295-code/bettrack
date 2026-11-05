'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PeriodUnit } from '@/lib/calculations/periods';
import { cn } from '@/lib/utils';
import type { Currency, Session } from '@/types';

export type RangeChoice = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface PeriodFilterState {
  currency: Currency;
  sessionId: string; // 'all' or a session id
  tags: string[];
  range: RangeChoice;
  from: string;
  to: string;
  unit: PeriodUnit;
}

interface Props {
  state: PeriodFilterState;
  onChange: (patch: Partial<PeriodFilterState> | ((s: PeriodFilterState) => Partial<PeriodFilterState>)) => void;
  currencies: readonly Currency[];
  sessions: readonly Session[]; // already limited to state.currency
  tags: readonly string[];
  customInvalid: boolean;
}

// Short visible labels keep all five on one row at phone width; aria-label gives the full meaning.
const RANGES: { value: RangeChoice; label: string; aria?: string }[] = [
  { value: '7d', label: '7D', aria: 'Last 7 days' },
  { value: '30d', label: '30D', aria: 'Last 30 days' },
  { value: '90d', label: '90D', aria: 'Last 90 days' },
  { value: 'all', label: 'All', aria: 'All time' },
  { value: 'custom', label: 'Custom', aria: 'Custom dates' },
];
const UNITS: { value: PeriodUnit; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function Segmented<T extends string>({ label, items, value, onSelect }: {
  label: string; items: { value: T; label: string; aria?: string }[]; value: T; onSelect: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {items.map(i => (
        <button
          key={i.value}
          type="button"
          aria-pressed={value === i.value}
          aria-label={i.aria}
          onClick={() => onSelect(i.value)}
          className={cn(
            'min-h-9 flex-1 rounded-md px-2 text-sm whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            value === i.value && 'bg-background text-foreground shadow-sm',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodFilters({ state, onChange, currencies, sessions, tags, customInvalid }: Props) {
  const currencyItems = currencies.map(c => ({ value: c, label: c }));
  const sessionItems = [{ value: 'all', label: 'All sessions' }, ...sessions.map(s => ({ value: s.id, label: s.name }))];
  // Functional update: two quick taps must not both read the same stale tag list.
  const toggleTag = (t: string) =>
    onChange(s => ({ tags: s.tags.includes(t) ? s.tags.filter(x => x !== t) : [...s.tags, t] }));

  return (
    <section aria-label="Filters" className="min-w-0 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <Label>Currency</Label>
          <Select
            items={currencyItems}
            value={state.currency}
            // Sessions belong to one currency, so a currency change resets the session choice.
            onValueChange={v => onChange({ currency: v as Currency, sessionId: 'all', tags: [] })}
          >
            <SelectTrigger className="w-full" aria-label="Currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencyItems.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label>Session</Label>
          <Select items={sessionItems} value={state.sessionId} onValueChange={v => onChange({ sessionId: String(v) })}>
            <SelectTrigger className="w-full min-w-0" aria-label="Session"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sessionItems.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 min-w-0 space-y-1">
          <span className="text-sm font-medium">Group by</span>
          <Segmented label="Group by" items={UNITS} value={state.unit} onSelect={unit => onChange({ unit })} />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium">Date range</span>
        <Segmented label="Date range" items={RANGES} value={state.range} onSelect={range => onChange({ range })} />
      </div>
      {state.range === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="p-from">From</Label>
            <Input id="p-from" type="date" value={state.from} max={state.to || undefined} onChange={e => onChange({ from: e.target.value })} />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="p-to">To</Label>
            <Input id="p-to" type="date" value={state.to} min={state.from || undefined} onChange={e => onChange({ to: e.target.value })} />
          </div>
          {customInvalid && (
            <p role="status" className="col-span-2 text-xs text-muted-foreground">Pick a From date on or before the To date.</p>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="space-y-1">
          <span className="text-sm font-medium">Tags <span className="font-normal text-muted-foreground">(any of)</span></span>
          <div role="group" aria-label="Tags" className="flex flex-wrap gap-1.5">
            {tags.map(t => {
              const on = state.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(t)}
                  className={cn(
                    'min-h-9 max-w-full truncate rounded-full border px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    on ? 'border-accent bg-accent/20 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
