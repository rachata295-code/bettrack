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
  // A read_error means storage threw while reading: the data may be intact, so it is never reset —
  // the user can only retry. Only corrupt keys are offered for download/reset.
  const corrupt = issues.filter(i => i.kind === 'corrupt');
  const readErrors = issues.filter(i => i.kind === 'read_error');

  function reset() {
    // Remove only the unreadable keys, straight from localStorage: the store's own
    // removeItem deliberately refuses to touch keys that failed to load.
    try {
      for (const { key } of corrupt) localStorage.removeItem(key);
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
        {corrupt.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Part of your saved data is corrupted or from an unsupported version. Nothing has been deleted yet. Download a
            copy first, then reset to start fresh.
          </p>
        )}
      </div>
      {readErrors.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
          <p>
            Storage could not be read right now ({readErrors.map(i => i.key).join(', ')}). Your data was not changed. Close
            other BetTrack tabs or check browser storage settings, then try again.
          </p>
          <Button variant="outline" onClick={() => location.reload()}>
            Try again
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {corrupt.map(issue => (
          <li key={issue.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="flex min-w-0 flex-col"><span className="text-sm font-medium">{shortName(issue.key)}</span><code className="num truncate text-xs text-muted-foreground">{issue.key}</code></span>
            <Button
              variant="outline"
              onClick={() => downloadText(`bettrack-raw-${shortName(issue.key)}.json`, issue.raw, 'application/json')}
            >
              Download raw data
            </Button>
          </li>
        ))}
      </ul>
      {corrupt.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="lg" />}>Reset data</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset unreadable data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes: {corrupt.map(i => i.key).join(', ')}. Download the raw data first if you may need it.
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
      )}
    </div>
  );
}
