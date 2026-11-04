'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { validateGuardPatch } from '@/lib/calculations/guard';
import { useSettingsStore } from '@/store/settings-store';
import type { GuardSettings } from '@/types';

// Everything is held as typed text so a half-edited field never corrupts stored settings.
interface FormState {
  mode: GuardSettings['sizing']['mode'];
  percent: string;
  minBet: string;
  low: string;
  high: string;
  streakEnabled: boolean;
  n: string;
  streakMode: GuardSettings['lossStreak']['mode'];
  cooldownMin: string;
  dailyLossLimit: string;
  chasingAlert: boolean;
}

const MODE_ITEMS = [
  { value: 'percent', label: '% of balance' },
  { value: 'fixed', label: 'Fixed (no suggestion)' },
];
const STREAK_MODE_ITEMS = [
  { value: 'soft', label: 'Soft banner' },
  { value: 'hard', label: 'Hard break' },
];

const toForm = (g: GuardSettings): FormState => ({
  mode: g.sizing.mode,
  percent: g.sizing.percent,
  minBet: g.sizing.minBet,
  low: g.riskBands.low,
  high: g.riskBands.high,
  streakEnabled: g.lossStreak.enabled,
  n: String(g.lossStreak.n),
  streakMode: g.lossStreak.mode,
  cooldownMin: String(g.lossStreak.cooldownMin),
  dailyLossLimit: g.dailyLossLimit ?? '',
  chasingAlert: g.chasingAlert,
});

// Empty text becomes NaN so the shared validator rejects it instead of reading it as 0.
const toInt = (s: string): number => (s.trim() === '' ? Number.NaN : Number(s));

export function GuardSettingsForm() {
  const guard = useSettingsStore(s => s.guard);
  const [form, setForm] = useState<FormState>(() => toForm(guard));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    const daily = form.dailyLossLimit.trim();
    const result = validateGuardPatch(guard, {
      sizing: { mode: form.mode, percent: form.percent.trim(), minBet: form.minBet.trim() },
      riskBands: { low: form.low.trim(), high: form.high.trim() },
      lossStreak: { enabled: form.streakEnabled, n: toInt(form.n), mode: form.streakMode, cooldownMin: toInt(form.cooldownMin) },
      // Empty field = limit off; the explicit undefined key clears a previously saved limit.
      dailyLossLimit: daily === '' ? undefined : daily,
      chasingAlert: form.chasingAlert,
    });
    if (!result.ok) {
      setErrors(result.errors);
      toast.error('Fix the highlighted fields');
      return;
    }
    // Same validator runs again inside the store; a rejection there would mean state changed underneath us.
    if (!useSettingsStore.getState().setGuard(result.value).ok) {
      toast.error('Could not save guard settings');
      return;
    }
    setErrors({});
    setForm(toForm(result.value));
    toast.success('Bankroll Guard saved');
  };

  const err = (k: string) => errors[k];
  const common = (k: string, id: string) => ({
    id,
    'aria-invalid': !!err(k),
    'aria-describedby': err(k) ? `${id}-err` : undefined,
    autoComplete: 'off',
  });
  const field = (k: string, id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {hint && !err(k) && <p className="text-xs text-muted-foreground">{hint}</p>}
      {err(k) && <p id={`${id}-err`} className="text-xs text-loss">{err(k)}</p>}
    </div>
  );
  const check = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="size-4 rounded border-border accent-[var(--accent)]"
      />
      {label}
    </label>
  );

  return (
    <form className="space-y-5" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
      <p className="text-sm text-muted-foreground">Suggestions protect your balance; they do not predict outcomes.</p>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Bet sizing</legend>
        {field('sizing.mode', 'gs-mode', 'Sizing mode', (
          <Select items={MODE_ITEMS} value={form.mode} onValueChange={v => v && set('mode', v as FormState['mode'])}>
            <SelectTrigger id="gs-mode" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{MODE_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        <div className="grid grid-cols-2 gap-3">
          {field('sizing.percent', 'gs-percent', 'Percent of balance', (
            <Input {...common('sizing.percent', 'gs-percent')} inputMode="decimal" value={form.percent} onChange={e => set('percent', e.target.value)} />
          ))}
          {field('sizing.minBet', 'gs-minbet', 'Minimum bet', (
            <Input {...common('sizing.minBet', 'gs-minbet')} inputMode="decimal" value={form.minBet} onChange={e => set('minBet', e.target.value)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Risk bands (bet as % of balance)</legend>
        <div className="grid grid-cols-2 gap-3">
          {field('riskBands.low', 'gs-low', 'Low up to', (
            <Input {...common('riskBands.low', 'gs-low')} inputMode="decimal" value={form.low} onChange={e => set('low', e.target.value)} />
          ))}
          {field('riskBands.high', 'gs-high', 'High above', (
            <Input {...common('riskBands.high', 'gs-high')} inputMode="decimal" value={form.high} onChange={e => set('high', e.target.value)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Loss streak</legend>
        {check('gs-streak-enabled', 'Warn after consecutive losses', form.streakEnabled, v => set('streakEnabled', v))}
        <div className="grid grid-cols-2 gap-3">
          {field('lossStreak.n', 'gs-n', 'Losses in a row', (
            <Input {...common('lossStreak.n', 'gs-n')} inputMode="numeric" value={form.n} onChange={e => set('n', e.target.value)} />
          ), '2 to 20')}
          {field('lossStreak.mode', 'gs-streak-mode', 'When reached', (
            <Select items={STREAK_MODE_ITEMS} value={form.streakMode} onValueChange={v => v && set('streakMode', v as FormState['streakMode'])}>
              <SelectTrigger id="gs-streak-mode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{STREAK_MODE_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          ))}
        </div>
        {field('lossStreak.cooldownMin', 'gs-cooldown', 'Break length (minutes)', (
          <Input {...common('lossStreak.cooldownMin', 'gs-cooldown')} inputMode="numeric" value={form.cooldownMin} onChange={e => set('cooldownMin', e.target.value)} />
        ), 'Used by Hard break. 1 to 120')}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Limits and alerts</legend>
        {field('dailyLossLimit', 'gs-daily', 'Daily loss limit (optional)', (
          <Input {...common('dailyLossLimit', 'gs-daily')} inputMode="decimal" placeholder="Off" value={form.dailyLossLimit} onChange={e => set('dailyLossLimit', e.target.value)} />
        ), 'Counts today’s net loss across sessions of the same currency. Empty = off.')}
        {check('gs-chasing', 'Alert when I raise my bet right after a loss', form.chasingAlert, v => set('chasingAlert', v))}
      </fieldset>

      <Button type="submit">Save Bankroll Guard</Button>
    </form>
  );
}
