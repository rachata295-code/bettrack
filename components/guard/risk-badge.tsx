'use client';

import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { RiskLevel } from '@/lib/calculations/guard';
import { formatPercent } from '@/lib/calculations/money';
import { cn } from '@/lib/utils';

// Icon + word per level so the meaning never depends on colour alone.
const LEVELS: Record<RiskLevel, { label: string; Icon: typeof ShieldCheck; className: string }> = {
  low: { label: 'Low', Icon: ShieldCheck, className: 'bg-profit/15 text-profit' },
  medium: { label: 'Medium', Icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-400' },
  high: { label: 'High', Icon: ShieldAlert, className: 'bg-loss/15 text-loss' },
};

export function RiskBadge({ pct, level }: { pct: string; level: RiskLevel }) {
  const { label, Icon, className } = LEVELS[level];
  return (
    <span
      className={cn('num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', className)}
      aria-label={`${label} risk: ${formatPercent(pct, 1)} of balance`}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(pct, 1)} of balance
    </span>
  );
}
