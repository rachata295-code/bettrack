'use client';

import { toast } from 'sonner';
import { setStorageErrorHandler } from '@/store/storage';

// Registered at module load (imported first by HydrationGate) rather than in an effect, so errors
// raised while the stores hydrate also reach the user. Sonner replays toasts created before the
// Toaster mounts; the fixed id stops every failed write from stacking another toast.
setStorageErrorHandler(() =>
  toast.error('Could not save — storage is full or blocked. Export a backup now.', { id: 'storage-error' }),
);
