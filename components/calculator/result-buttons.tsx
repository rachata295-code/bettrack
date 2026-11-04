'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

const base =
  'flex h-16 min-h-16 items-center justify-center gap-2 rounded-xl text-lg font-semibold text-white transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40';

export function ResultButtons({
  onWin,
  onLose,
  disabled,
}: {
  onWin: () => void;
  onLose: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <motion.button
        type="button"
        whileTap={disabled ? undefined : { scale: 0.97 }}
        onClick={onWin}
        disabled={disabled}
        className={cn(base, 'bg-profit')}
      >
        <CheckCircle className="size-6" aria-hidden /> WIN
      </motion.button>
      <motion.button
        type="button"
        whileTap={disabled ? undefined : { scale: 0.97 }}
        onClick={onLose}
        disabled={disabled}
        className={cn(base, 'bg-loss')}
      >
        <XCircle className="size-6" aria-hidden /> LOSE
      </motion.button>
    </div>
  );
}
