'use client';

import { SimForm } from '@/components/simulator/sim-form';
import { SimResults } from '@/components/simulator/sim-results';
import { useDraft } from '@/hooks/use-draft';
import { useSimulation } from '@/hooks/use-simulation';
import { useTimeline } from '@/hooks/use-timeline';
import { useSettingsStore } from '@/store/settings-store';

export default function SimulatorPage() {
  const { session, balance } = useTimeline();
  const { bet, multiplier } = useDraft(session.id);
  const precision = useSettingsStore(s => s.precision);
  const sim = useSimulation();
  const running = sim.status === 'running';

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 lg:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Monte Carlo simulation under a win probability you assume. Not a forecast. · จำลองตามโอกาสชนะที่คุณสมมติ ไม่ใช่การพยากรณ์
        </p>
      </div>

      <SimForm
        // Keyed on session so switching session re-seeds the prefilled values.
        key={session.id}
        defaults={{ start: balance, bet, multiplier }}
        currency={session.currency}
        precision={precision}
        running={running}
        progress={sim.progress}
        onRun={sim.run}
        onCancel={sim.cancel}
      />

      {sim.status === 'cancelled' && (
        <p role="status" className="text-sm text-muted-foreground">Simulation cancelled.</p>
      )}
      {sim.status === 'error' && (
        <p role="alert" className="text-sm text-loss">{sim.error}</p>
      )}
      {sim.status === 'done' && sim.result && sim.input && (
        <SimResults result={sim.result} input={sim.input} currency={session.currency} precision={precision} />
      )}
    </div>
  );
}
