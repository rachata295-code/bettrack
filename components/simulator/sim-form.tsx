'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateSimInput, type SimInput } from '@/lib/calculations/montecarlo';
import { houseEdgeExampleP } from '@/lib/calculations/risk';
import { randomSeed } from '@/hooks/use-simulation';
import type { Currency } from '@/types';

export interface SimFormDefaults {
  start: string;
  bet: string;
  multiplier: string;
}

interface SimFormProps {
  defaults: SimFormDefaults;
  currency: Currency;
  precision: number;
  running: boolean;
  onRun: (input: SimInput) => void;
  onCancel: () => void;
  progress: number;
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-err`} role="alert" className="text-xs text-loss">{error}</p>
        : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SimForm({ defaults, currency, precision, running, onRun, onCancel, progress }: SimFormProps) {
  const uid = useId();
  const [p, setP] = useState('');
  const [multiplier, setMultiplier] = useState(defaults.multiplier);
  const [start, setStart] = useState(defaults.start);
  const [betMode, setBetMode] = useState<'fixed' | 'percent'>('fixed');
  const [bet, setBet] = useState(defaults.bet);
  const [percent, setPercent] = useState('10');
  const [minBet, setMinBet] = useState('0.1');
  const [rounds, setRounds] = useState('100');
  const [runs, setRuns] = useState('10000');
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const example = houseEdgeExampleP(multiplier);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    const v = validateSimInput({
      p, multiplier, start, betMode, bet, percent, minBet, rounds, runs, seed, precision: String(precision),
    });
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    onRun(v.value);
  }

  const id = (n: string) => `${uid}-${n}`;
  const inputProps = (n: string, value: string, set: (v: string) => void, numeric = false) => ({
    id: id(n),
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value),
    inputMode: (numeric ? 'numeric' : 'decimal') as 'numeric' | 'decimal',
    autoComplete: 'off',
    disabled: running,
    className: 'h-11 text-base',
    'aria-invalid': errors[n] ? true : undefined,
    'aria-describedby': errors[n] ? `${id(n)}-err` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold">Assumptions</h2>

      <Field label="Win probability per round (%)" id={id('p')} error={errors.p}
        hint="Your own assumption. The simulator does not know the game's real odds.">
        <Input {...inputProps('p', p, setP)} placeholder="e.g. 48.77" />
      </Field>
      <Button type="button" variant="outline" className="min-h-11" disabled={!example || running}
        onClick={() => example && setP(example)}>
        Example: 1% house edge
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Multiplier (x)" id={id('multiplier')} error={errors.multiplier}>
          <Input {...inputProps('multiplier', multiplier, setMultiplier)} />
        </Field>
        <Field label={`Starting balance (${currency})`} id={id('start')} error={errors.start}>
          <Input {...inputProps('start', start, setStart)} />
        </Field>
      </div>

      <fieldset className="space-y-2" disabled={running}>
        <legend className="mb-1.5 text-sm font-medium">Bet size</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['fixed', 'percent'] as const).map(m => (
            <Button key={m} type="button" className="min-h-11" variant={betMode === m ? 'default' : 'outline'}
              aria-pressed={betMode === m} onClick={() => setBetMode(m)}>
              {m === 'fixed' ? 'Fixed' : '% of balance'}
            </Button>
          ))}
        </div>
        {betMode === 'fixed' ? (
          <Field label={`Bet (${currency})`} id={id('bet')} error={errors.bet}>
            <Input {...inputProps('bet', bet, setBet)} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Percent of balance (%)" id={id('percent')} error={errors.percent}>
              <Input {...inputProps('percent', percent, setPercent)} />
            </Field>
            <Field label={`Minimum bet (${currency})`} id={id('minBet')} error={errors.minBet}>
              <Input {...inputProps('minBet', minBet, setMinBet)} />
            </Field>
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rounds" id={id('rounds')} error={errors.rounds}>
          <Input {...inputProps('rounds', rounds, setRounds, true)} />
        </Field>
        <Field label="Runs" id={id('runs')} error={errors.runs}>
          <Input {...inputProps('runs', runs, setRuns, true)} />
        </Field>
      </div>

      <Field label="Seed" id={id('seed')} error={errors.seed} hint="Same seed and settings give the same result.">
        <div className="flex gap-2">
          <Input {...inputProps('seed', seed, setSeed, true)} />
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={running}
            onClick={() => setSeed(String(randomSeed()))}>
            New seed
          </Button>
        </div>
      </Field>

      {running ? (
        <div className="space-y-2">
          <div role="progressbar" aria-label="Simulation progress" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)} className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="num text-sm text-muted-foreground">Running… {Math.round(progress * 100)}%</span>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button type="submit" className="min-h-11 w-full">Run simulation</Button>
      )}
    </form>
  );
}
