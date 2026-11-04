'use client';

import Link from 'next/link';
import { BalanceCard } from '@/components/dashboard/balance-card';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { ResultButtons } from '@/components/calculator/result-buttons';
import { validateBetInput } from '@/lib/calculations/round';
import { useRecordRound } from '@/hooks/use-record-round';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export default function DashboardPage() {
  const { session, timeline, stats, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const { record, locked } = useRecordRound(session.defaultBet, session.defaultMultiplier);
  // Same rule as the Calculator: session defaults must be valid against the live balance.
  const v = validateBetInput({ balance, bet: session.defaultBet, multiplier: session.defaultMultiplier });
  const canRecord = v.ok && !locked;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <BalanceCard
        stats={stats}
        currency={session.currency}
        precision={precision}
        hasInsufficient={timeline.some(r => r.insufficient)}
      />
      <section aria-label="Quick record" className="space-y-2">
        <ResultButtons onWin={() => canRecord && record('win')} onLose={() => canRecord && record('lose')} disabled={!canRecord} />
        <p className="num text-sm text-muted-foreground">
          Bet {session.defaultBet} {session.currency} @ {session.defaultMultiplier}x ·{' '}
          <Link href="/calculator" className="underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
            Edit in Calculator
          </Link>
        </p>
        {!v.ok && <p className="text-sm text-loss">Default bet is not valid for the current balance. Edit it in the Calculator.</p>}
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
