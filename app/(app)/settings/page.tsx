'use client';

import { useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { GuardSettingsForm } from '@/components/guard/guard-settings-form';
import { RealityCheckForm } from '@/components/settings/reality-check-form';
import { FxFeesForm } from '@/components/settings/fx-fees-form';
import { WithdrawalCalculator } from '@/components/wallet/withdrawal-calculator';
import { ImportDialog } from '@/components/sessions/import-dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/lib/calculations/money';
import { createBackup } from '@/lib/io/backup';
import { useWalletStore } from '@/store/wallet-store';
import { downloadText } from '@/lib/io/download';
import { exportFilename } from '@/lib/io/filename';
import { useBetStore } from '@/store/bet-store';
import { DEFAULT_PRECISION, useSettingsStore } from '@/store/settings-store';

const PRECISION_ITEMS = Array.from({ length: 9 }, (_, i) => ({ value: String(i), label: `${i} decimal places` }));
const CONFIRM_WORD = 'RESET';

export default function SettingsPage() {
  const precision = useSettingsStore(s => s.precision);
  const setPrecision = useSettingsStore(s => s.setPrecision);
  const guard = useSettingsStore(s => s.guard);
  const fx = useSettingsStore(s => s.fx);
  const fees = useSettingsStore(s => s.fees);
  const realityCheck = useSettingsStore(s => s.realityCheck);
  const [importing, setImporting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const canReset = typed.trim() === CONFIRM_WORD;

  const exportBackup = () => {
    try {
      const { sessions } = useBetStore.getState();
      const { transactions } = useWalletStore.getState();
      downloadText(exportFilename('backup', 'json'), JSON.stringify(createBackup(sessions, { precision, guard, fx, fees, realityCheck }, transactions), null, 2), 'application/json');
    } catch {
      toast.error('Export failed');
    }
  };

  const reset = () => {
    if (!canReset) return;
    useBetStore.getState().resetAll();
    useWalletStore.getState().resetAll();
    setPrecision(DEFAULT_PRECISION);
    useSettingsStore.getState().resetGuard();
    useSettingsStore.getState().resetFxFees();
    setResetOpen(false);
    toast('All data reset');
  };

  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="max-w-md space-y-3" aria-labelledby="set-display">
        <h2 id="set-display" className="text-lg font-medium">Display</h2>
        <div className="space-y-1.5">
          <Label htmlFor="set-precision">Precision</Label>
          <Select items={PRECISION_ITEMS} value={String(precision)} onValueChange={v => v !== null && setPrecision(Number(v))}>
            <SelectTrigger id="set-precision" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRECISION_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="num text-sm text-muted-foreground" aria-live="polite">
            Example: 1234.56789 → <span className="text-foreground">{formatMoney('1234.56789', { precision })}</span>
          </p>
          <p className="text-xs text-muted-foreground">Only affects how numbers are shown. Stored values keep full precision.</p>
        </div>
      </section>

      <section className="max-w-md space-y-3" aria-labelledby="set-guard">
        <h2 id="set-guard" className="text-lg font-medium">Bankroll Guard</h2>
        {/* key re-mounts the form when settings change elsewhere (e.g. a backup import). */}
        <GuardSettingsForm key={JSON.stringify(guard)} />
      </section>

      <section className="max-w-md space-y-4" aria-labelledby="set-fx">
        <h2 id="set-fx" className="text-lg font-medium">Exchange rates &amp; fees</h2>
        {/* key re-mounts the form when settings change elsewhere (e.g. a backup import). */}
        <FxFeesForm key={JSON.stringify({ fx, fees })} />
        <WithdrawalCalculator />
      </section>

      <section className="max-w-md space-y-3" aria-labelledby="set-reality">
        <h2 id="set-reality" className="text-lg font-medium">Reality check</h2>
        {/* key re-mounts the form when settings change elsewhere (e.g. a backup import). */}
        <RealityCheckForm key={JSON.stringify(realityCheck)} />
      </section>

      <section className="max-w-md space-y-3" aria-labelledby="set-data">
        <h2 id="set-data" className="text-lg font-medium">Data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportBackup}><Download /> Export backup</Button>
          <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import</Button>
          <Button variant="destructive" onClick={() => { setTyped(''); setResetOpen(true); }}><Trash2 /> Reset all data</Button>
        </div>
      </section>

      <ImportDialog open={importing} onOpenChange={setImporting} />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every session and round and restores default settings. It cannot be undone. Type
              <strong className="mx-1 text-foreground">{CONFIRM_WORD}</strong>
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form id="reset-form" onSubmit={e => { e.preventDefault(); reset(); }}>
            <Label htmlFor="reset-confirm" className="sr-only">Type {CONFIRM_WORD} to confirm</Label>
            <Input id="reset-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" placeholder={CONFIRM_WORD} />
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" form="reset-form" variant="destructive" disabled={!canReset}>Reset all data</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
