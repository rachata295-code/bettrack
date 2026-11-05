'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney, formatPercent, isPositive, parseMoneyInput } from '@/lib/calculations/money';
import {
  breakEvenRounds,
  breakEvenWinRate,
  currentLoss,
  evPerRound,
  houseEdgeExampleP,
  isAboveOne,
  parseProbability,
  probAtLeastOneWinPct,
} from '@/lib/calculations/risk';
import type { Currency } from '@/types';

interface RiskToolsProps {
  currency: Currency;
  precision: number;
  /** Calculator draft values (strings as typed; may be invalid mid-edit). */
  bet: string;
  multiplier: string;
  initialBalance: string;
  balance: string;
}

const DEFAULT_K = '5';
const MAX_K = 1000;

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-loss">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num text-base font-semibold">{value}</div>
    </div>
  );
}

export function RiskTools({ currency, precision, bet, multiplier, initialBalance, balance }: RiskToolsProps) {
  const uid = useId();
  const [pRaw, setPRaw] = useState('');
  const [kRaw, setKRaw] = useState(DEFAULT_K);
  // null = follow the live default (initial − current); a string once the user edits it.
  const [lossRaw, setLossRaw] = useState<string | null>(null);

  const mParsed = parseMoneyInput(multiplier);
  const mValid = mParsed.ok && isAboveOne(mParsed.value);
  const bParsed = parseMoneyInput(bet);
  const bValid = bParsed.ok && isPositive(bParsed.value);
  const money = (v: string, signed = false) => formatMoney(v, { precision, currency, signed });

  // --- Win probability estimate ---
  const pTrimmed = pRaw.trim();
  const pParsed = pTrimmed === '' ? null : parseProbability(pTrimmed);
  const pError = pParsed && !pParsed.ok ? 'Enter a percent greater than 0 and less than 100.' : null;
  const p = pParsed && pParsed.ok ? pParsed.value : null;

  const kTrimmed = kRaw.trim();
  const kNum = /^\d+$/.test(kTrimmed) ? Number(kTrimmed) : NaN;
  const kValid = Number.isInteger(kNum) && kNum >= 1 && kNum <= MAX_K;
  const kError = kValid ? null : `Enter a whole number from 1 to ${MAX_K}.`;

  const example = mValid ? houseEdgeExampleP(multiplier) : null;
  const ev = p && mValid && bValid ? evPerRound(bet, p, multiplier) : null;

  // --- Break-even calculator ---
  const lossDefault = currentLoss(initialBalance, balance);
  const lossText = lossRaw ?? lossDefault;
  const lossParsed = parseMoneyInput(lossText.trim());
  const lossError = lossParsed.ok ? null : 'Enter an amount of 0 or more.';
  const rounds = lossParsed.ok && mValid && bValid ? breakEvenRounds(lossParsed.value, bet, multiplier) : null;

  const pId = `${uid}-p`;
  const kId = `${uid}-k`;
  const lossId = `${uid}-loss`;

  return (
    <section aria-label="Risk tools" className="space-y-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold">Risk tools</h2>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Break-even win rate at {multiplier}x</div>
        {mValid ? (
          <div className="num text-2xl font-semibold">{formatPercent(breakEvenWinRate(multiplier), 2)}</div>
        ) : (
          <div className="text-sm text-muted-foreground">Set a multiplier above 1 in the Calculator to see this.</div>
        )}
        <p className="text-xs text-muted-foreground">Mathematical break-even, not the game&apos;s actual win chance.</p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Field label="Your estimate of win probability (%)" id={pId} error={pError}>
          <Input
            id={pId} inputMode="decimal" autoComplete="off" placeholder="e.g. 48.77"
            className="h-11 text-base" value={pRaw} onChange={e => setPRaw(e.target.value)}
            aria-invalid={pError ? true : undefined} aria-describedby={pError ? `${pId}-err` : undefined}
          />
        </Field>
        <Button
          type="button" variant="outline" className="min-h-11"
          disabled={!example} onClick={() => example && setPRaw(example)}
        >
          Example: 1% house edge
        </Button>

        <Field label="Rounds (k)" id={kId} error={kError}>
          <Input
            id={kId} inputMode="numeric" autoComplete="off" className="h-11 text-base"
            value={kRaw} onChange={e => setKRaw(e.target.value)}
            aria-invalid={kError ? true : undefined} aria-describedby={kError ? `${kId}-err` : undefined}
          />
        </Field>

        {p && (
          <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
            {ev !== null ? (
              // Neutral colour on purpose: p is the user's own guess, so a green "+" must not read as a promise.
              <Result label={`Expected value per round at your estimate (bet ${money(bet)})`} value={money(ev, true)} />
            ) : (
              <p className="text-sm text-muted-foreground">Set a valid bet and multiplier in the Calculator to see expected value.</p>
            )}
            {kValid && (
              <Result
                label={`If your estimate (${pTrimmed}%) is right: chance of ≥1 win in ${kNum} rounds`}
                value={formatPercent(probAtLeastOneWinPct(p, kNum), 2)}
              />
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Break-even calculator</h3>
        <Field label={`Loss to recover (${currency})`} id={lossId} error={lossError} hint="Defaults to your starting balance minus current balance.">
          <Input
            id={lossId} inputMode="decimal" autoComplete="off" className="h-11 text-base"
            value={lossText} onChange={e => setLossRaw(e.target.value)}
            aria-invalid={lossError ? true : undefined} aria-describedby={lossError ? `${lossId}-err` : undefined}
          />
        </Field>
        <div aria-live="polite" className="space-y-1">
          {!lossParsed.ok ? null : !isPositive(lossParsed.value) ? (
            <p className="text-sm text-muted-foreground">Nothing to recover.</p>
          ) : !mValid || !bValid ? (
            <p className="text-sm text-muted-foreground">Set a valid bet and a multiplier above 1 in the Calculator.</p>
          ) : rounds !== null ? (
            <p className="text-sm">
              About <span className="num font-semibold">{rounds}</span> winning {rounds === 1 ? 'round' : 'rounds'} at {money(bet)} @ {multiplier}x
              {' '}to recover {money(lossParsed.value)}.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">No outcome is guaranteed.</p>
          <p className="text-xs text-muted-foreground">
            Recovering a loss is never guaranteed; chasing losses increases risk. · การไล่ทุนคืนไม่มีอะไรรับประกัน และยิ่งเพิ่มความเสี่ยง
          </p>
        </div>
      </div>
    </section>
  );
}
