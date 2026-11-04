'use client';

import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { downloadText } from '@/lib/io/download';
import { clearLoadIssue, type LoadIssue } from '@/store/storage';

// "bettrack:v1:bets" -> "bets"; used for the download filename.
const shortName = (key: string) => key.split(':').pop() ?? key;

export function RecoveryScreen({ issues }: { issues: LoadIssue[] }) {
  function reset() {
    // Remove only the unreadable keys, straight from localStorage: the store's own
    // removeItem deliberately refuses to touch keys that failed to load.
    try {
      for (const { key } of issues) localStorage.removeItem(key);
    } catch {
      toast.error('Could not reset data — storage is blocked. Download your raw data and clear site data manually.');
      return;
    }
    clearLoadIssue();
    location.reload();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Saved data could not be read</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Part of your saved data is corrupted or from an unsupported version. Nothing has been deleted yet. Download a copy
          first, then reset to start fresh.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {issues.map(issue => (
          <li key={issue.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
            <code className="num truncate text-xs">{issue.key}</code>
            <Button
              variant="outline"
              onClick={() => downloadText(`bettrack-raw-${shortName(issue.key)}.json`, issue.raw, 'application/json')}
            >
              Download raw data
            </Button>
          </li>
        ))}
      </ul>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="lg" />}>Reset data</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset unreadable data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes: {issues.map(i => i.key).join(', ')}. Download the raw data first if you may need it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={reset}>
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
