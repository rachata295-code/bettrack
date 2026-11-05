'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { BalanceCard } from '@/components/dashboard/balance-card';
import { RealPnlLinkCard } from '@/components/dashboard/real-pnl-link-card';
import { PeriodSummary } from '@/components/dashboard/period-summary';
import { BalanceChart } from '@/components/charts/balance-chart';
import { GuardStatusCard } from '@/components/guard/guard-status-card';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { ResultButtons } from '@/components/calculator/result-buttons';
import { GuardNotices } from '@/components/guard/guard-notices';
import { LimitDialog } from '@/components/guard/limit-dialog';
import { approxThbLabel } from '@/lib/calculations/fx';
import { balanceSeries } from '@/lib/calculations/series';
import { validateBetInput } from '@/lib/calculations/round';
import { Button } from '@/components/ui/button';
import { useDraft } from '@/hooks/use-draft';
import { useGuard } from '@/hooks/use-guard';
import { useGuardedRecord } from '@/hooks/use-guarded-record';
import { useTimeline } from '@/hooks/use-timeline';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

export default function DashboardPage() {
  const { session, timeline, stats, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const fx = useSettingsStore(s => s.fx);
  // Same per-session draft as the Calculator, so quick WIN/LOSE records what the user last set there.
  const { bet, multiplier } = useDraft(session.id);
  const { record, undo, locked, pending, confirm, cancel } = useGuardedRecord(bet, multiplier);
  const sessions = useBetStore(s => s.sessions);
  const guard = useGuard(bet);
  const series = useMemo(
    () => balanceSeries(session.initialBalance, timeline, precision),
    [session.initialBalance, timeline, precision],
  );
  const v = validateBetInput({ balance, bet, multiplier });
  const canRecord = v.ok && !locked && guard.cooldownRemainingMs === 0 && !pending;

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
        approxThb={approxThbLabel(stats.current, session.currency, fx, precision)}
      />
      <section aria-label="Quick record" className="space-y-2">
        {/* Keyed by session: the Dashboard is not remounted on switch, and a dismissal is per session. */}
        <GuardNotices
          key={session.id}
          streakAlert={guard.streakAlert} lossStreak={guard.lossStreak} cooldownRemainingMs={guard.cooldownRemainingMs} />
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
      <PeriodSummary sessions={sessions} currency={session.currency} precision={precision} />
      <RealPnlLinkCard currency={session.currency} />
      <GuardStatusCard guard={guard} precision={precision} currency={session.currency} />
      <LimitDialog pending={pending} precision={precision} currency={session.currency} onConfirm={confirm} onCancel={cancel} />
      {timeline.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No rounds yet. Record your first round with WIN or LOSE above.
        </div>
      ) : (
        <>
          <section aria-label="Balance chart" className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Balance</h2>
              <Link
                href="/analytics"
                className="text-sm underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                Open analytics
              </Link>
            </div>
            {/* Start-balance reference stays on (fixed): it is the one line that tells up from down at a glance. */}
            <BalanceChart
              data={series}
              initialBalance={series[0]?.balance ?? 0}
              showReference
              currency={session.currency}
              precision={precision}
              height={160}
            />
          </section>
          <StatsGrid stats={stats} currency={session.currency} precision={precision} />
        </>
      )}
    </div>
  );
}
