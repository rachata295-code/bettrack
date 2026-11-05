'use client';

import { useMemo, useState } from 'react';
import { RiskTools } from '@/components/analytics/risk-tools';
import { BalanceChart } from '@/components/charts/balance-chart';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { balanceSeries } from '@/lib/calculations/series';
import { useDraft } from '@/hooks/use-draft';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export function SessionTab() {
  const { session, timeline, stats, balance } = useTimeline();
  const precision = useSettingsStore(s => s.precision);
  const { bet, multiplier } = useDraft(session.id);
  const [showReference, setShowReference] = useState(true);
  const series = useMemo(
    () => balanceSeries(session.initialBalance, timeline, precision),
    [session.initialBalance, timeline, precision],
  );
  const empty = timeline.length === 0;

  return (
    <div className="space-y-5">
      {empty ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No rounds yet in this session. Record rounds to see the balance chart and statistics — the risk tools below work anyway.
        </div>
      ) : (
        <>
          <section aria-label="Balance chart" className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Balance</h2>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox" className="size-4 accent-[var(--accent)]"
                  checked={showReference} onChange={e => setShowReference(e.target.checked)}
                />
                Starting balance line
              </label>
            </div>
            <BalanceChart
              data={series}
              // series[0] is the starting balance as a chart number (series.ts is the only place money becomes number).
              initialBalance={series[0]?.balance ?? 0}
              showReference={showReference}
              currency={session.currency}
              precision={precision}
            />
          </section>
          <StatsGrid stats={stats} currency={session.currency} precision={precision} />
        </>
      )}
      <RiskTools
        currency={session.currency}
        precision={precision}
        bet={bet}
        multiplier={multiplier}
        initialBalance={session.initialBalance}
        balance={balance}
      />
    </div>
  );
}
