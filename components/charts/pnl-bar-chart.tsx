'use client';

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/calculations/money';
import { periodLabel } from '@/lib/calculations/period-format';
import type { PeriodUnit } from '@/lib/calculations/periods';
import type { BucketPoint } from '@/lib/calculations/series';
import type { Currency } from '@/types';

interface Props {
  data: readonly BucketPoint[];
  unit: PeriodUnit;
  currency: Currency;
  precision: number;
  height?: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ChartTooltip({ active, payload, currency, unit }: { active?: boolean; payload?: readonly { payload?: BucketPoint }[]; currency: Currency; unit: PeriodUnit }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs tabular-nums shadow-md">
      <div className="font-medium">{periodLabel(p.key, unit)}</div>
      <div>P&amp;L: {p.pnlText} {currency}</div>
      <div>Cumulative: {p.cumulativeText} {currency}</div>
    </div>
  );
}

export function PnlBarChart({ data, unit, currency, precision, height = 260 }: Props) {
  const last = data[data.length - 1];
  const summary = last
    ? `P&L per ${unit} for ${data.length} ${data.length === 1 ? 'period' : 'periods'} (${periodLabel(data[0]!.key, unit)} to ${periodLabel(last.key, unit)}), cumulative ${last.cumulativeText} ${currency}`
    : 'P&L chart with no data';
  const animate = !prefersReducedMotion();
  return (
    <figure aria-label={summary} className="m-0 w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data as BucketPoint[]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="key" tickFormatter={(k: string) => periodLabel(k, unit)} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} minTickGap={12} />
          <YAxis width={56} tickFormatter={(v: number) => formatMoney(String(v), { precision })}
            stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Tooltip content={<ChartTooltip currency={currency} unit={unit} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          <Bar dataKey="pnl" isAnimationActive={animate} maxBarSize={40}>
            {data.map(p => <Cell key={p.key} fill={p.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />)}
          </Bar>
          <Line type="monotone" dataKey="cumulative" stroke="var(--accent)" strokeWidth={2} dot={data.length <= 60}
            isAnimationActive={animate} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
