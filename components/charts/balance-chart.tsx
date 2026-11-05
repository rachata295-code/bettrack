'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/calculations/money';
import type { BalancePoint } from '@/lib/calculations/series';
import type { Currency } from '@/types';

// Above this many points, per-point dots cost more than they tell.
const MAX_DOT_POINTS = 500;

interface BalanceChartProps {
  data: readonly BalancePoint[];
  initialBalance: number;
  showReference: boolean;
  currency: Currency;
  precision: number;
  height?: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function dotColor(result: BalancePoint['result']): string {
  if (result === 'win') return 'var(--profit)';
  if (result === 'lose') return 'var(--loss)';
  return 'var(--muted-foreground)';
}

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: readonly { payload?: BalancePoint }[]; currency: Currency }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs tabular-nums shadow-md">
      <div className="font-medium">{p.round === 0 ? 'Start' : `Round ${p.round}`}</div>
      <div>Balance: {p.balanceText} {currency}</div>
      {p.result && (
        <>
          <div>Result: {p.result === 'win' ? 'Win' : 'Loss'}</div>
          <div>P&amp;L: {p.pnlText} {currency}</div>
        </>
      )}
    </div>
  );
}

export function BalanceChart({ data, initialBalance, showReference, currency, precision, height = 280 }: BalanceChartProps) {
  const last = data[data.length - 1];
  const first = data[0];
  const showDots = data.length <= MAX_DOT_POINTS;
  const summary = first && last
    ? `Balance over ${Math.max(data.length - 1, 0)} rounds, from ${first.balanceText} to ${last.balanceText} ${currency}`
    : 'Balance chart with no data';

  return (
    <figure aria-label={summary} className="m-0 w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data as BalancePoint[]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="round" type="number" domain={[0, 'dataMax']} allowDecimals={false}
            stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} width={56} tickFormatter={(v: number) => formatMoney(String(v), { precision })}
            stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          {showReference && (
            <ReferenceLine y={initialBalance} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          )}
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--accent)"
            strokeWidth={2}
            isAnimationActive={!prefersReducedMotion()}
            dot={showDots
              ? (props: { cx?: number; cy?: number; payload?: BalancePoint; index?: number }) => (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={3} fill={dotColor(props.payload?.result ?? null)} stroke="none" />
              )
              : false}
            activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'none' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
