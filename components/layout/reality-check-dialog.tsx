'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRealityCheck } from '@/hooks/use-reality-check';

/** Mounted once in AppShell. Dismissing (Esc) counts as "Keep playing": the user is never trapped. */
export function RealityCheckDialog() {
  const { open, elapsedText, pnlText, sessionName, takeBreak, keepPlaying } = useRealityCheck();
  return (
    <AlertDialog open={open} onOpenChange={o => !o && keepPlaying()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reality check</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve been playing for {elapsedText} today in {sessionName}. Today&apos;s P&amp;L:{' '}
            <span className="num">{pnlText}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">พักสักครู่ก่อนเล่นต่อ — แต่ละรอบเป็นอิสระต่อกัน</p>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={keepPlaying}>Keep playing</AlertDialogCancel>
          <AlertDialogAction onClick={takeBreak}>Take a break</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
