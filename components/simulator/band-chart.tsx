'use client';

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { simMoney, type BandPoint } from '@/lib/calculations/series';
import type { Currency } from '@/types';

interface BandChartProps {
  data: readonly BandPoint[];
  start: number;
  currency: Currency;
  precision: number;
  height?: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: readonly { payload?: BandPoint }[]; currency: Currency }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs tabular-nums shadow-md">
      <div className="font-medium">{p.round === 0 ? 'Start' : `Round ${p.round}`}</div>
      <div>High (p90): {p.p90Text} {currency}</div>
      <div>Median (p50): {p.p50Text} {currency}</div>
      <div>Low (p10): {p.p10Text} {currency}</div>
    </div>
  );
}

export function BandChart({ data, start, currency, precision, height = 280 }: BandChartProps) {
  const last = data[data.length - 1];
  const summary = last
    ? `Simulated balance range over ${last.round} rounds. At the end, the middle 80% of runs fall between ${last.p10Text} and ${last.p90Text} ${currency}, median ${last.p50Text}`
    : 'Simulation chart with no data';
  const animate = !prefersReducedMotion();

  return (
    <figure aria-label={summary} className="m-0 w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data as BandPoint[]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="round" type="number" domain={[0, 'dataMax']} allowDecimals={false}
            stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} width={56} tickFormatter={(v: number) => simMoney(v, precision)}
            stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <ReferenceLine y={start} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="range" stroke="none" fill="var(--accent)" fillOpacity={0.2}
            isAnimationActive={animate} activeDot={false} />
          <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={2} dot={false}
            isAnimationActive={animate} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'none' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
