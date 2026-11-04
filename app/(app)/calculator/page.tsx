'use client';

import { useRef, useState } from 'react';
import { BetForm } from '@/components/calculator/bet-form';
import { ResultButtons } from '@/components/calculator/result-buttons';
import { RoundPreview } from '@/components/calculator/round-preview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BET_ERROR_MESSAGES, previewRound, validateBetInput, type BetInputError } from '@/lib/calculations/round';
import { SHORTCUT_HELP } from '@/lib/shortcuts';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useRecordRound } from '@/hooks/use-record-round';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export default function CalculatorPage() {
  const { session } = useTimeline();
  // Keyed by session id so local bet/multiplier reset to the new session's defaults on switch.
  return <Calculator key={session.id} />;
}

function Calculator() {
  const { session, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const [bet, setBet] = useState(session.defaultBet);
  const [multiplier, setMultiplier] = useState(session.defaultMultiplier);
  const [helpOpen, setHelpOpen] = useState(false);
  const betRef = useRef<HTMLInputElement>(null);
  const multRef = useRef<HTMLInputElement>(null);
  const { record, undo, locked } = useRecordRound(bet, multiplier);

  const v = validateBetInput({ balance, bet, multiplier });
  const errors: BetInputError[] = v.ok ? [] : v.errors;
  const msgs = (kinds: BetInputError[]) => errors.filter(e => kinds.includes(e)).map(e => BET_ERROR_MESSAGES[e]);
  const preview = v.ok ? previewRound(balance, v.bet, v.multiplier) : null;
  // Shared by buttons and keyboard so W/L obey exactly the same rules.
  const canRecord = v.ok && !locked && !helpOpen;

  useKeyboardShortcuts({
    win: () => canRecord && record('win'),
    lose: () => canRecord && record('lose'),
    undo: () => !helpOpen && undo(),
    focusBet: () => betRef.current?.focus(),
    focusMultiplier: () => multRef.current?.focus(),
    help: () => setHelpOpen(true),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calculator</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={undo}>
            Undo
          </Button>
          <Button variant="ghost" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts">
            ?
          </Button>
        </div>
      </div>
      <BetForm
        bet={bet}
        multiplier={multiplier}
        onBetChange={setBet}
        onMultiplierChange={setMultiplier}
        betError={msgs(['invalid_bet', 'insufficient_balance', 'no_balance'])}
        multiplierError={msgs(['invalid_multiplier'])}
        balance={balance}
        currency={session.currency}
        precision={precision}
        betRef={betRef}
        multiplierRef={multRef}
      />
      <RoundPreview preview={preview} precision={precision} />
      <ResultButtons onWin={() => canRecord && record('win')} onLose={() => canRecord && record('lose')} disabled={!v.ok || locked} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUT_HELP.map(s => (
                <tr key={s.keys} className="border-t border-border first:border-0">
                  <td className="py-2 pr-4">
                    <kbd className="rounded bg-elevated px-2 py-0.5 font-mono">{s.keys}</kbd>
                  </td>
                  <td className="py-2">{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
