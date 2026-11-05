'use client';

import type { ReactNode, Ref } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/calculations/money';
import type { Money } from '@/types';

interface BetFormProps {
  bet: string;
  multiplier: string;
  onBetChange: (v: string) => void;
  onMultiplierChange: (v: string) => void;
  betError?: string[];
  multiplierError?: string[];
  balance: Money;
  currency: string;
  precision: number;
  betRef: Ref<HTMLInputElement>;
  multiplierRef: Ref<HTMLInputElement>;
  /** Shown right under the Bet input (e.g. the guard's risk badge). */
  betAdornment?: ReactNode;
}

export function BetForm({ betRef, multiplierRef, betAdornment, ...p }: BetFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Current balance</p>
        <p className="num text-4xl font-semibold">
          {formatMoney(p.balance, { precision: p.precision })}{' '}
          <span className="text-lg text-muted-foreground">{p.currency}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="bet"
          label="Bet"
          value={p.bet}
          onChange={p.onBetChange}
          errors={p.betError}
          inputRef={betRef}
          adornment={betAdornment}
        />
        <Field
          id="multiplier"
          label="Multiplier"
          value={p.multiplier}
          onChange={p.onMultiplierChange}
          errors={p.multiplierError}
          inputRef={multiplierRef}
        />
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  errors,
  inputRef,
  adornment,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  errors?: string[];
  inputRef: Ref<HTMLInputElement>;
  adornment?: ReactNode;
}) {
  const invalid = !!errors?.length;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="num h-12 text-lg md:text-lg"
      />
      {/* Under the input (not beside the label) so both inputs stay aligned on narrow phones. */}
      {adornment && <div>{adornment}</div>}
      {errors && errors.length > 0 && (
        <div id={`${id}-error`} role="alert" className="space-y-0.5 text-sm text-loss">
          {errors.map(m => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
    </div>
  );
}
