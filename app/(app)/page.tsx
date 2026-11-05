'use client';

import Link from 'next/link';
import { BalanceCard } from '@/components/dashboard/balance-card';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { ResultButtons } from '@/components/calculator/result-buttons';
import { validateBetInput } from '@/lib/calculations/round';
import { Button } from '@/components/ui/button';
import { useDraft } from '@/hooks/use-draft';
import { useRecordRound } from '@/hooks/use-record-round';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export default function DashboardPage() {
  const { session, timeline, stats, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  // Same per-session draft as the Calculator, so quick WIN/LOSE records what the user last set there.
  const { bet, multiplier } = useDraft(session.id);
  const { record, undo, locked } = useRecordRound(bet, multiplier);
  const v = validateBetInput({ balance, bet, multiplier });
  const canRecord = v.ok && !locked;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="truncate text-sm text-muted-foreground">{session.name}</p>
      </div>
      <BalanceCard
        stats={stats}
        currency={session.currency}
        precision={precision}
        hasInsufficient={timeline.some(r => r.insufficient)}
      />
      <section aria-label="Quick record" className="space-y-2">
        <ResultButtons onWin={() => canRecord && record('win')} onLose={() => canRecord && record('lose')} disabled={!canRecord} />
        <div className="flex items-center justify-between gap-2">
          <p className="num text-sm text-muted-foreground">
            Bet {bet} {session.currency} @ {multiplier}x ·{' '}
            <Link href="/calculator" className="underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
              Edit in Calculator
            </Link>
          </p>
          <Button variant="outline" onClick={undo}>
            Undo
          </Button>
        </div>
        {!v.ok && <p className="text-sm text-loss">Bet is not valid for the current balance. Edit it in the Calculator.</p>}
      </section>
      {timeline.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No rounds yet. Record your first round with WIN or LOSE above.
        </div>
      ) : (
        <StatsGrid stats={stats} currency={session.currency} precision={precision} />
      )}
    </div>
  );
}
