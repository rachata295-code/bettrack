'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Soft loss-streak nudge. Copy deliberately avoids implying the next round is "due" a win. */
export function StreakBanner({ streak, onDismiss }: { streak: number; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p>
          <span className="num font-medium">{streak}</span> losses in a row. Consider a short break — each round is
          independent; a streak does not make the next win more likely.
        </p>
        <p className="text-xs text-muted-foreground">แต่ละรอบเป็นอิสระต่อกัน การแพ้ติดกันไม่ได้ทำให้รอบหน้ามีโอกาสชนะมากขึ้น</p>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss loss streak notice">
        <X aria-hidden />
      </Button>
    </div>
  );
}
