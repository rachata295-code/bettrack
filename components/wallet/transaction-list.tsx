'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/calculations/money';
import { isoToBangkokLocal } from '@/lib/calculations/period-format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';
import type { Transaction } from '@/types';
import { TransactionDialog } from './transaction-dialog';

function TypeBadge({ type }: { type: Transaction['type'] }) {
  return (
    <Badge variant="outline" className={cn(type === 'deposit' ? 'border-primary/40 bg-primary/15 text-primary' : 'border-profit/40 bg-profit/15 text-profit')}>
      {type === 'deposit' ? 'Deposit' : 'Withdraw'}
    </Badge>
  );
}

export function TransactionList() {
  const transactions = useWalletStore(s => s.transactions);
  const precision = useSettingsStore(s => s.precision);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  // Newest first by actual instant, not insertion order.
  // Equal timestamps: later insertion first (reverse before a stable sort).
  const sorted = useMemo(() => [...transactions].reverse().sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [transactions]);
  // Keep the last edited item until the exit animation ends, so the form never flashes "Add transaction".
  const [lastEdited, setLastEdited] = useState<Transaction | null>(null);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
        <Wallet className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-medium">No transactions yet</p>
        <p className="text-sm text-muted-foreground">Add your deposits and withdrawals to see your real result.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {sorted.map(t => (
          <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={t.type} />
                <span className="num font-medium">{formatMoney(t.amount, { precision, currency: t.currency })}</span>
              </div>
              <p className="num text-xs text-muted-foreground">
                {isoToBangkokLocal(t.at).replace('T', ' ')} (Bangkok)
                {' · '}fee {formatMoney(t.fee, { precision, currency: t.currency })}
              </p>
              {t.note && <p className="break-words text-sm">{t.note}</p>}
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" aria-label={`Edit ${t.type}`} onClick={() => { setLastEdited(t); setEditing(t); }}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${t.type}`} onClick={() => setDeleting(t)}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
      <TransactionDialog transaction={editing ?? lastEdited ?? undefined} open={editing !== null} onOpenChange={o => !o && setEditing(null)} />
      <AlertDialog open={deleting !== null} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>Your real P&amp;L will be recalculated without it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) useWalletStore.getState().deleteTransaction(deleting.id);
                setDeleting(null);
                toast('Transaction deleted');
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
