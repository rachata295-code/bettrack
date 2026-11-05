'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseMoneyInput } from '@/lib/calculations/money';
import { MAX_NAME, MAX_TAGS, validateSessionForm, type SessionFormField, type SessionFormInput } from '@/lib/session-form';
import { useBetStore } from '@/store/bet-store';
import { CURRENCIES, type Session } from '@/types';

interface Props {
  mode: 'create' | 'edit';
  session?: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCY_ITEMS = CURRENCIES.map(c => ({ value: c, label: c }));

export function SessionFormDialog({ mode, session, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Body mounts only while open, so drafts always restart from the saved session. */}
        <SessionForm mode={mode} session={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SessionForm({ mode, session, onDone }: { mode: 'create' | 'edit'; session?: Session; onDone: () => void }) {
  const [form, setForm] = useState<SessionFormInput>({
    name: session?.name ?? '',
    currency: session?.currency ?? 'USDT',
    initialBalance: session?.initialBalance ?? '16.99',
    defaultBet: session?.defaultBet ?? '4',
    defaultMultiplier: session?.defaultMultiplier ?? '2.03',
    tags: session?.tags.join(', ') ?? '',
  });
  const [submitted, setSubmitted] = useState(false);

  const result = validateSessionForm(form);
  const errors = result.ok ? {} : result.errors;
  // Show errors only after the first submit attempt (name) so an empty create form is not red on open.
  const err = (f: SessionFormField) => (submitted ? errors[f] : undefined);

  const balanceChanged = (() => {
    if (mode !== 'edit' || !session) return false;
    const p = parseMoneyInput(form.initialBalance);
    return p.ok && p.value !== session.initialBalance;
  })();

  const set = <K extends SessionFormField>(k: K, v: SessionFormInput[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    setSubmitted(true);
    if (!result.ok) return;
    const store = useBetStore.getState();
    if (mode === 'create') {
      store.createSession({ ...result.value, name: result.value.name });
      toast.success(`Session "${result.value.name}" created`);
    } else if (session) {
      if (!store.updateSession(session.id, result.value).ok) {
        toast.error('Could not save changes');
        return;
      }
      toast.success('Session updated');
    }
    onDone();
  };

  const field = (f: SessionFormField, label: string, input: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={`sf-${f}`}>{label}</Label>
      {input}
      {err(f) && <p id={`sf-${f}-err`} className="text-xs text-loss">{err(f)}</p>}
    </div>
  );
  const common = (f: SessionFormField) => ({
    id: `sf-${f}`,
    'aria-invalid': !!err(f),
    'aria-describedby': err(f) ? `sf-${f}-err` : undefined,
    autoComplete: 'off',
  });

  return (
    <form className="grid gap-4" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'New session' : 'Edit session'}</DialogTitle>
        <DialogDescription>
          {mode === 'create' ? 'A session tracks one bankroll and its rounds.' : 'Update this session’s details and defaults.'}
        </DialogDescription>
      </DialogHeader>

      {field('name', 'Name', (
        <Input {...common('name')} value={form.name} maxLength={MAX_NAME + 20} onChange={e => set('name', e.target.value)} autoFocus />
      ))}

      <div className="grid grid-cols-2 gap-3">
        {field('currency', 'Currency', (
          <Select items={CURRENCY_ITEMS} value={form.currency} onValueChange={v => v && set('currency', v as SessionFormInput['currency'])}>
            <SelectTrigger id="sf-currency" className="w-full" aria-label="Currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCY_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        {field('initialBalance', 'Initial balance', (
          <Input {...common('initialBalance')} inputMode="decimal" value={form.initialBalance} onChange={e => set('initialBalance', e.target.value)} />
        ))}
      </div>

      {balanceChanged && (
        <p role="status" className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted-foreground">
          All balances in this session will be recalculated
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field('defaultBet', 'Default bet', (
          <Input {...common('defaultBet')} inputMode="decimal" value={form.defaultBet} onChange={e => set('defaultBet', e.target.value)} />
        ))}
        {field('defaultMultiplier', 'Default multiplier', (
          <Input {...common('defaultMultiplier')} inputMode="decimal" value={form.defaultMultiplier} onChange={e => set('defaultMultiplier', e.target.value)} />
        ))}
      </div>

      {field('tags', `Tags (comma-separated, max ${MAX_TAGS})`, (
        <Input {...common('tags')} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. dice, low-risk" />
      ))}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{mode === 'create' ? 'Create session' : 'Save'}</Button>
      </DialogFooter>
    </form>
  );
}
