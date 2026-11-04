'use client';

// Must stay the first import: registers the storage error toast before any store module hydrates.
import './storage-error-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useHydrated } from '@/hooks/use-hydrated';
import { getLoadIssues } from '@/store/storage';
import { RecoveryScreen } from './recovery-screen';

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4 p-6" aria-busy="true" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  // Read only after hydration: issues are recorded while the stores load, and the server has none.
  const issues = getLoadIssues();
  if (issues.length > 0) return <RecoveryScreen issues={issues} />;
  return <>{children}</>;
}
