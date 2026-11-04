'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MultiplierChips } from '@/components/calculator/multiplier-chips';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { D, formatMoney, parseMoneyInput } from '@/lib/calculations/money';
import { recentMultipliers } from '@/lib/calculations/multipliers';
import { computeTimeline, currentBalance } from '@/lib/calculations/timeline';
import { cn } from '@/lib/utils';
import { useTimeline } from '@/hooks/use-timeline';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import type { Round, RoundResult } from '@/types';

interface Props {
  round: Round;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRoundDialog({ round, index, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Body mounts only while open, so its draft state always starts from the saved round. */}
        <EditForm round={round} index={index} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ round, index, onDone }: { round: Round; index: number; onDone: () => void }) {
  const { session, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const sessions = useBetStore(s => s.sessions);
  const chipOptions = useMemo(
    () => recentMultipliers(sessions, { defaultMultiplier: session.defaultMultiplier }),
    [sessions, session.defaultMultiplier],
  );
  const [result, setResult] = useState<RoundResult>(round.result);
  const [bet, setBet] = useState(round.bet);
  const [multiplier, setMultiplier] = useState(round.multiplier);
  const [note, setNote] = useState(round.note ?? '');

  const parsedBet = parseMoneyInput(bet);
  const parsedMult = parseMoneyInput(multiplier);
  const betError = !parsedBet.ok || !D(parsedBet.value).gt(0) ? 'Enter a bet greater than 0' : null;
  const multError = !parsedMult.ok || !D(parsedMult.value).gt(1) ? 'Multiplier must be greater than 1' : null;
  const valid = !betError && !multError;

  // Preview comes from the same timeline lib as the page, applied to a patched copy of the rounds.
  let after: string | null = null;
  if (parsedBet.ok && parsedMult.ok && valid) {
    const patched = session.rounds.map(r =>
      r.id === round.id ? { ...r, result, bet: parsedBet.value, multiplier: parsedMult.value } : r,
    );
    after = currentBalance(session.initialBalance, computeTimeline(session.initialBalance, patched));
  }

  const save = () => {
    if (!valid) return;
    const res = useBetStore.getState().editRound(round.id, { result, bet, multiplier, note });
    if (!res.ok) {
      toast.error('Could not save changes');
      return;
    }
    toast.success(`Round ${index} updated`);
    onDone();
  };

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit round {index}</DialogTitle>
        <DialogDescription>Later balances are recalculated from this round onward.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Result</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Result">
          {(['win', 'lose'] as const).map(r => (
            <Button
              key={r}
              type="button"
              variant="outline"
              aria-pressed={result === r}
              onClick={() => setResult(r)}
              className={cn(
                result === r && (r === 'win' ? 'border-profit bg-profit/15 text-profit' : 'border-loss bg-loss/15 text-loss'),
              )}
            >
              {r === 'win' ? 'WIN' : 'LOSE'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-bet">Bet</Label>
          <Input id="edit-bet" inputMode="decimal" autoComplete="off" value={bet} onChange={e => setBet(e.target.value)} aria-invalid={!!betError} aria-describedby={betError ? 'edit-bet-err' : undefined} />
          {betError && <p id="edit-bet-err" className="text-xs text-loss">{betError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-mult">Multiplier</Label>
          <Input id="edit-mult" inputMode="decimal" autoComplete="off" value={multiplier} onChange={e => setMultiplier(e.target.value)} aria-invalid={!!multError} aria-describedby={multError ? 'edit-mult-err' : undefined} />
          {multError && <p id="edit-mult-err" className="text-xs text-loss">{multError}</p>}
        </div>
      </div>

      <MultiplierChips value={multiplier} defaultMultiplier={session.defaultMultiplier} options={chipOptions} onPick={setMultiplier} />

      <div className="space-y-1.5">
        <Label htmlFor="edit-note">Note</Label>
        <Input id="edit-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
      </div>

      <p className="num rounded-lg bg-elevated px-3 py-2 text-sm" aria-live="polite">
        Final balance:{' '}
        <span className="text-muted-foreground">{formatMoney(balance, { precision })}</span>
        {' → '}
        <span className="font-medium">{after === null ? '—' : formatMoney(after, { precision })}</span>{' '}
        <span className="text-muted-foreground">{session.currency}</span>
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!valid}>Save</Button>
      </DialogFooter>
    </form>
  );
}
