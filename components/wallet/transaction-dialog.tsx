'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bangkokLocalToIso, isoToBangkokLocal } from '@/lib/calculations/period-format';
import { MAX_NOTE_LEN, validateTransaction } from '@/lib/calculations/wallet';
import { useBetStore } from '@/store/bet-store';
import { useWalletStore } from '@/store/wallet-store';
import { CURRENCIES, type Currency, type Transaction, type TransactionType } from '@/types';

const CURRENCY_ITEMS = CURRENCIES.map(c => ({ value: c, label: c }));
const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
];

interface Props {
  /** Present = edit mode. */
  transaction?: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDialog({ transaction, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Body mounts only while open, so drafts always start from the saved transaction. */}
        <TransactionForm transaction={transaction} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function nowBangkokLocal(): string {
  return isoToBangkokLocal(new Date().toISOString());
}

function TransactionForm({ transaction, onDone }: { transaction?: Transaction; onDone: () => void }) {
  const editing = !!transaction;
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'deposit');
  const [amount, setAmount] = useState(transaction?.amount ?? '');
  const [currency, setCurrency] = useState<Currency>(
    () => transaction?.currency ?? useBetStore.getState().sessions.find(s => s.id === useBetStore.getState().activeSessionId)?.currency ?? 'USDT',
  );
  const [fee, setFee] = useState(transaction?.fee ?? '0');
  const [at, setAt] = useState(() => (transaction ? isoToBangkokLocal(transaction.at) : nowBangkokLocal()));
  const [note, setNote] = useState(transaction?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const iso = bangkokLocalToIso(at);
    if (iso === null) {
      setErrors({ at: 'Enter a valid date and time' });
      return;
    }
    const input = { type, amount, currency, fee, at: iso, note };
    const v = validateTransaction(input);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    const store = useWalletStore.getState();
    // Explicit `note` key so clearing the note overrides the stored one in the store's merge.
    const res = transaction ? store.updateTransaction(transaction.id, { ...v.value, note: v.value.note }) : store.addTransaction(v.value);
    if (!res.ok) {
      setErrors('errors' in res && res.errors ? res.errors : {});
      toast.error('Could not save transaction');
      return;
    }
    toast.success(editing ? 'Transaction updated' : 'Transaction added');
    onDone();
  };

  const err = (k: string) => errors[k];
  const fieldErr = (k: string) => (err(k) ? <p id={`tx-${k}-err`} className="text-xs text-loss">{err(k)}</p> : null);

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
        <DialogDescription>Deposits and withdrawals between your bank or wallet and the platform. Time is Bangkok time.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
          {TYPES.map(t => (
            <Button
              key={t.value}
              type="button"
              // Filled vs outline is unambiguous in both themes (class overrides lose to the outline variant's dark styles).
              variant={type === t.value ? 'default' : 'outline'}
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {fieldErr('type')}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">Amount</Label>
          <Input id="tx-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!!err('amount')} aria-describedby={err('amount') ? 'tx-amount-err' : undefined} />
          {fieldErr('amount')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-currency">Currency</Label>
          <Select items={CURRENCY_ITEMS} value={currency} onValueChange={v => v && setCurrency(v as Currency)}>
            <SelectTrigger id="tx-currency" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCY_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
          {fieldErr('currency')}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 min-[420px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-fee">Fee ({currency})</Label>
          <Input id="tx-fee" inputMode="decimal" autoComplete="off" value={fee} onChange={e => setFee(e.target.value)} aria-invalid={!!err('fee')} aria-describedby={err('fee') ? 'tx-fee-err' : undefined} />
          {fieldErr('fee')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-at">Date &amp; time</Label>
          <Input id="tx-at" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} aria-invalid={!!err('at')} aria-describedby={err('at') ? 'tx-at-err' : undefined} />
          {fieldErr('at')}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-note">Note</Label>
        <Input id="tx-note" value={note} maxLength={MAX_NOTE_LEN + 50} onChange={e => setNote(e.target.value)} placeholder="Optional" aria-invalid={!!err('note')} aria-describedby={err('note') ? 'tx-note-err' : undefined} />
        {fieldErr('note')}
      </div>
      {err('_') && <p role="alert" className="text-sm text-loss">{err('_')}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
