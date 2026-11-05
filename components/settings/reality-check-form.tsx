'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateRealityCheck } from '@/lib/calculations/reality-check';
import { useSettingsStore } from '@/store/settings-store';

export function RealityCheckForm() {
  const current = useSettingsStore(s => s.realityCheck);
  // Interval is held as typed text so a half-edited field never corrupts stored settings.
  const [enabled, setEnabled] = useState(current.enabled);
  const [intervalText, setIntervalText] = useState(String(current.intervalMin));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const trimmed = intervalText.trim();
    const r = validateRealityCheck({ enabled, intervalMin: /^\d+$/.test(trimmed) ? Number(trimmed) : NaN });
    if (!r.ok) {
      setErrors(r.errors);
      toast.error('Fix the highlighted fields');
      return;
    }
    if (!useSettingsStore.getState().setRealityCheck(r.value).ok) {
      toast.error('Could not save reality check');
      return;
    }
    setErrors({});
    toast.success('Reality check saved');
  };

  return (
    <form className="space-y-3" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
      <p className="text-sm text-muted-foreground">
        A reminder showing how long you have played today and today&apos;s P&amp;L.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        Remind me while I play
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="rc-interval">Remind every (minutes)</Label>
        <Input
          id="rc-interval"
          inputMode="numeric"
          autoComplete="off"
          value={intervalText}
          aria-invalid={!!errors.intervalMin}
          aria-describedby={errors.intervalMin ? 'rc-interval-err' : undefined}
          onChange={e => setIntervalText(e.target.value)}
        />
        {errors.intervalMin
          ? <p id="rc-interval-err" className="text-xs text-loss">{errors.intervalMin}</p>
          : <p className="text-xs text-muted-foreground">Whole minutes, 5 to 240.</p>}
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}
