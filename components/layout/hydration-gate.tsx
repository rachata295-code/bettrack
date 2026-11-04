'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useHydrated } from '@/hooks/use-hydrated';
import { getLoadIssues, setStorageErrorHandler } from '@/store/storage';
import { RecoveryScreen } from './recovery-screen';

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  useEffect(() => {
    setStorageErrorHandler(() => toast.error('Could not save — storage is full or blocked. Export a backup now.'));
  }, []);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4 p-6" aria-busy="true">
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
