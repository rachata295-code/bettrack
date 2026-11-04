'use client';

import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatLimitHit, type LimitHitDetail } from '@/lib/calculations/guard';
import type { Currency, RoundResult } from '@/types';

/** Asked every time a round is recorded while a limit is reached; recording is still the user's call. */
export function LimitDialog({
  pending,
  precision,
  currency,
  onConfirm,
  onCancel,
}: {
  pending: { result: RoundResult; hits: LimitHitDetail[] } | null;
  precision: number;
  currency: Currency;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Keep the last request on screen during the close animation instead of flashing empty text.
  const [shown, setShown] = useState(pending);
  if (pending !== null && pending !== shown) setShown(pending);
  return (
    <AlertDialog open={pending !== null} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limit reached</AlertDialogTitle>
          <AlertDialogDescription>
            You set these limits for yourself. Record this {shown?.result.toUpperCase()} round anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="num space-y-1 text-sm">
          {shown?.hits.map(h => (
            <li key={h.hit}>{formatLimitHit(h, precision, currency)}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Record anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
