'use client';

import { Timer } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatCountdown } from '@/lib/calculations/guard';
import { useBetStore } from '@/store/bet-store';

/** Hard-mode break: recording is locked until the countdown ends or the user explicitly ends it. */
export function CooldownPanel({ remainingMs }: { remainingMs: number }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="flex items-center gap-2">
        <Timer className="size-4 shrink-0 text-amber-400" aria-hidden />
        <span>
          Break in progress — recording resumes in{' '}
          <span className="num font-semibold" aria-live="off">
            {formatCountdown(remainingMs)}
          </span>
        </span>
      </p>
      <AlertDialog>
        <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>End break now</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the break now?</AlertDialogTitle>
            <AlertDialogDescription>
              The break was set after a loss streak. Each round is independent — a streak does not make the next win more likely.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep break</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => useBetStore.getState().clearCooldown()}>
              End break
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
