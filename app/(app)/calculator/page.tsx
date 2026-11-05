'use client';

import { useMemo, useRef, useState } from 'react';
import { BetForm } from '@/components/calculator/bet-form';
import { MultiplierChips } from '@/components/calculator/multiplier-chips';
import { ResultButtons } from '@/components/calculator/result-buttons';
import { RoundPreview } from '@/components/calculator/round-preview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GuardNotices } from '@/components/guard/guard-notices';
import { LimitDialog } from '@/components/guard/limit-dialog';
import { RiskBadge } from '@/components/guard/risk-badge';
import { SuggestedBet } from '@/components/guard/suggested-bet';
import { isSameAmount } from '@/lib/calculations/guard';
import { BET_ERROR_MESSAGES, previewRound, validateBetInput, type BetInputError } from '@/lib/calculations/round';
import { recentMultipliers } from '@/lib/calculations/multipliers';
import { SHORTCUT_HELP } from '@/lib/shortcuts';
import { useDraft } from '@/hooks/use-draft';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useGuard } from '@/hooks/use-guard';
import { useGuardedRecord } from '@/hooks/use-guarded-record';
import { useTimeline } from '@/hooks/use-timeline';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

export default function CalculatorPage() {
  const { session } = useTimeline();
  // Keyed by session id so transient UI state (help dialog, record lock) resets on switch.
  return <Calculator key={session.id} />;
}

function Calculator() {
  const { session, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  // Persisted per session so edits survive navigation/refresh and the Dashboard uses the same values.
  const { bet, multiplier, setBet, setMultiplier } = useDraft(session.id);
  const sessions = useBetStore(s => s.sessions);
  const chipOptions = useMemo(
    () => recentMultipliers(sessions, { defaultMultiplier: session.defaultMultiplier }),
    [sessions, session.defaultMultiplier],
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const betRef = useRef<HTMLInputElement>(null);
  const multRef = useRef<HTMLInputElement>(null);
  const sizing = useSettingsStore(s => s.guard.sizing);
  const { record, undo, locked, pending, confirm, cancel } = useGuardedRecord(bet, multiplier);
  const guard = useGuard(bet);
  const onBreak = guard.cooldownRemainingMs > 0;

  const v = validateBetInput({ balance, bet, multiplier });
  const errors: BetInputError[] = v.ok ? [] : v.errors;
  const msgs = (kinds: BetInputError[]) => errors.filter(e => kinds.includes(e)).map(e => BET_ERROR_MESSAGES[e]);
  const preview = v.ok ? previewRound(balance, v.bet, v.multiplier) : null;
  // Shared by buttons and keyboard so W/L obey exactly the same rules.
  // A pending limit confirmation also blocks W/L so a key press can't stack a second request.
  const canRecord = v.ok && !locked && !helpOpen && !onBreak && !pending;
  // Suggestion is hidden when it would change nothing (same amount as typed) or sizing is fixed.
  // A 'capped' suggestion (balance below minBet) is still shown, as a notice instead of an amount.
  const suggestion = guard.suggested;
  const showSuggestion =
    sizing.mode === 'percent' && suggestion !== null && (suggestion.reason === 'capped' || !isSameAmount(suggestion.amount, bet));

  useKeyboardShortcuts({
    win: () => canRecord && record('win'),
    lose: () => canRecord && record('lose'),
    // Undo never records, so it stays available during a break; only dialogs block it.
    undo: () => !helpOpen && !pending && undo(),
    focusBet: () => betRef.current?.focus(),
    focusMultiplier: () => multRef.current?.focus(),
    help: () => setHelpOpen(true),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Calculator</h1>
          <p className="truncate text-sm text-muted-foreground">{session.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={undo}>
            Undo
          </Button>
          <Button variant="ghost" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts">
            ?
          </Button>
        </div>
      </div>
      {/* Buttons sit right under the inputs on phones so recording never needs a scroll; desktop keeps preview first. */}
      {/* Tighter gaps on phones keep WIN/LOSE in the first viewport even with suggestion, badge and streak notice. */}
      <div className="flex flex-col gap-3 lg:gap-5">
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
          betAdornment={guard.risk && <RiskBadge pct={guard.risk.pct} level={guard.risk.level} />}
        />
        {showSuggestion && (
          <SuggestedBet
            suggestion={suggestion!}
            percent={sizing.percent}
            precision={precision}
            currency={session.currency}
            onUse={setBet}
          />
        )}
        {/* Picks write to the draft only; session default and past rounds stay untouched. */}
        <MultiplierChips value={multiplier} defaultMultiplier={session.defaultMultiplier} options={chipOptions} onPick={setMultiplier} />
        <div className="space-y-3 lg:order-last">
          <GuardNotices streakAlert={guard.streakAlert} lossStreak={guard.lossStreak} cooldownRemainingMs={guard.cooldownRemainingMs} />
          <ResultButtons
            onWin={() => canRecord && record('win')}
            onLose={() => canRecord && record('lose')}
            disabled={!v.ok || locked || onBreak}
          />
        </div>
        <RoundPreview preview={preview} precision={precision} />
      </div>
      <LimitDialog pending={pending} precision={precision} currency={session.currency} onConfirm={confirm} onCancel={cancel} />
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
