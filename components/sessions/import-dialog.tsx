'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseBackup, type Backup } from '@/lib/io/backup';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounts only while open so a previously chosen file never lingers. */}
        <ImportBody onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const onFile = async (file: File | undefined) => {
    setError(null);
    setBackup(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseBackup(await file.text());
      if (parsed.ok) setBackup(parsed.backup);
      else setError(parsed.error);
    } catch {
      setError('Could not read the selected file.');
    }
  };

  const run = (mode: 'merge' | 'replace') => {
    if (!backup) return;
    try {
      const { added, skipped } = useBetStore.getState().importSessions(backup.sessions, mode);
      // M1/M2 backups carry no transactions: leave the wallet untouched (even on Replace) rather than wiping it.
      if (backup.transactions) useWalletStore.getState().importTransactions(backup.transactions, mode);
      // Backups carry precision as a display preference; restoring it keeps "same as before" true after Replace.
      if (mode === 'replace' && backup.settings) {
        useSettingsStore.getState().setPrecision(backup.settings.precision);
        // Older (M1) backups carry no guard: keep the user's current guard rather than resetting it.
        if (backup.settings.guard) useSettingsStore.getState().setGuard({ ...backup.settings.guard, dailyLossLimit: backup.settings.guard.dailyLossLimit });  // explicit key so a missing limit clears the old one
      }
      // Restored only when present, so M1/M2 backups keep the user's current rates and fees.
      if (mode === 'replace' && backup.settings) {
        const st = useSettingsStore.getState();
        // Explicit '' clears a rate the backup does not have.
        if (backup.settings.fx) st.setFx({ usdtThb: backup.settings.fx.usdtThb ?? '', usdThb: backup.settings.fx.usdThb ?? '' });
        if (backup.settings.fees) st.setFees(backup.settings.fees);
      }
      toast.success(`Imported ${added} sessions (${skipped} skipped)`);
      onDone();
    } catch {
      setError('Import failed. Your existing data was not changed.');
    }
  };

  const rounds = backup ? backup.sessions.reduce((n, s) => n + s.rounds.length, 0) : 0;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import backup</DialogTitle>
        <DialogDescription>Choose a BetTrack backup (.json) file exported from this app.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="import-file">Backup file</Label>
        <Input id="import-file" type="file" accept=".json,application/json" onChange={e => void onFile(e.target.files?.[0])} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-loss/50 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      )}

      {backup && (
        <div className="space-y-1 rounded-lg bg-elevated px-3 py-2 text-sm" aria-live="polite">
          <p className="num font-medium">{backup.sessions.length} sessions, {rounds} rounds{backup.transactions ? `, ${backup.transactions.length} transactions` : ''}</p>
          <p className="text-muted-foreground">{fileName}</p>
          <p className="text-muted-foreground">Merge keeps your data and skips sessions and transactions with an id you already have. Replace deletes everything here first.</p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="button" disabled={!backup} onClick={() => run('merge')}>Merge</Button>
        <Button type="button" variant="destructive" disabled={!backup} onClick={() => setConfirmReplace(true)}>Replace</Button>
      </DialogFooter>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription>
              All current sessions and rounds{backup?.transactions ? ' and wallet transactions' : ''} will be deleted and replaced by the {backup?.sessions.length ?? 0} sessions{backup?.transactions ? ` and ${backup.transactions.length} transactions` : ''} in this file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => { setConfirmReplace(false); run('replace'); }}>Replace all</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
