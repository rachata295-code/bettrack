'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFeesPatch, validateFxPatch } from '@/lib/calculations/fx';
import { useSettingsStore } from '@/store/settings-store';

// Held as typed text so a half-edited field never corrupts stored settings.
interface FormState {
  usdtThb: string;
  usdThb: string;
  cryptoWithdrawFee: string;
  tradeFeePct: string;
  spreadPct: string;
  thbWithdrawFee: string;
}

export function FxFeesForm() {
  const fx = useSettingsStore(s => s.fx);
  const fees = useSettingsStore(s => s.fees);
  const [form, setForm] = useState<FormState>(() => ({
    usdtThb: fx.usdtThb ?? '',
    usdThb: fx.usdThb ?? '',
    ...fees,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    // Validate both before applying either, so a bad fee never leaves rates half-saved.
    const fxR = validateFxPatch({ usdtThb: form.usdtThb, usdThb: form.usdThb });
    const feesR = validateFeesPatch(fees, {
      cryptoWithdrawFee: form.cryptoWithdrawFee,
      tradeFeePct: form.tradeFeePct,
      spreadPct: form.spreadPct,
      thbWithdrawFee: form.thbWithdrawFee,
    });
    if (!fxR.ok || !feesR.ok) {
      setErrors({ ...(fxR.ok ? {} : fxR.errors), ...(feesR.ok ? {} : feesR.errors) });
      toast.error('Fix the highlighted fields');
      return;
    }
    const st = useSettingsStore.getState();
    // setFx merges, so send both keys explicitly: '' clears a rate.
    if (!st.setFx({ usdtThb: form.usdtThb.trim(), usdThb: form.usdThb.trim() }).ok || !st.setFees(feesR.value).ok) {
      toast.error('Could not save exchange rates and fees');
      return;
    }
    setErrors({});
    toast.success('Exchange rates & fees saved');
  };

  const field = (k: keyof FormState, id: string, label: string, hint?: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={form[k]}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${id}-err` : undefined}
        onChange={e => set(k, e.target.value)}
      />
      {hint && !errors[k] && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors[k] && <p id={`${id}-err`} className="text-xs text-loss">{errors[k]}</p>}
    </div>
  );

  return (
    <form className="space-y-5" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
      <p className="text-sm text-muted-foreground">Rates are entered by you — BetTrack never fetches live prices.</p>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Exchange rates (THB per 1 unit)</legend>
        <div className="grid grid-cols-2 gap-3">
          {field('usdtThb', 'fx-usdt', 'USDT → THB', undefined, 'Not set')}
          {field('usdThb', 'fx-usd', 'USD → THB', undefined, 'Not set')}
        </div>
        <p className="text-xs text-muted-foreground">Empty = not set.</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Fees</legend>
        {field('cryptoWithdrawFee', 'fee-crypto', 'Crypto withdrawal fee', 'In the currency you withdraw (USDT or USD).')}
        <div className="grid grid-cols-2 gap-3">
          {field('tradeFeePct', 'fee-trade', 'Exchange trading fee (%)')}
          {field('spreadPct', 'fee-spread', 'Spread (%)')}
        </div>
        {field('thbWithdrawFee', 'fee-thb', 'THB withdrawal fee', 'In THB.')}
      </fieldset>
      <Button type="submit">Save exchange rates &amp; fees</Button>
    </form>
  );
}
