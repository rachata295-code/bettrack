'use client';

import { useMemo } from 'react';
import { BandChart } from './band-chart';
import type { SimInput, SimResult } from '@/lib/calculations/montecarlo';
import { bandSeries, simMoney, simPercent } from '@/lib/calculations/series';
import type { Currency } from '@/types';

interface SimResultsProps {
  result: SimResult;
  input: SimInput;
  currency: Currency;
  precision: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num text-base font-semibold">{value}</div>
    </div>
  );
}

export function SimResults({ result, input, currency, precision }: SimResultsProps) {
  const data = useMemo(() => bandSeries(result, precision), [result, precision]);
  const money = (n: number) => simMoney(n, precision, currency);

  return (
    <section aria-label="Simulation results" className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold">Results</h2>
      {/* Neutral colours on purpose: every figure depends on the user's assumed p. */}
      <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
        <Stat label="Risk of ruin (could not afford the next bet)" value={simPercent(result.ruinProb)} />
        <Stat label="Median final balance" value={money(result.medianFinal)} />
        <Stat label="Chance of finishing above start" value={simPercent(result.probAboveStart)} />
        <Stat label="Mean final balance" value={money(result.meanFinal)} />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Balance range</h3>
        <p className="text-xs text-muted-foreground">
          Line = median. Shaded area = middle 80% of {input.runs.toLocaleString('en-US')} runs (10th to 90th percentile). Dashed line = starting balance.
        </p>
        <BandChart data={data} start={input.start} currency={currency} precision={precision} />
      </div>
      <p className="text-xs text-muted-foreground">
        Simulated under your assumed win probability. Real outcomes can differ; this is not a forecast.
        {' '}· ผลนี้เป็นการจำลองตามโอกาสชนะที่คุณสมมติ ไม่ใช่การพยากรณ์
      </p>
    </section>
  );
}
