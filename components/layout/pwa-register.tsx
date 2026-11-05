'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

const UPDATE_TOAST_ID = 'sw-update';

// navigator.onLine via useSyncExternalStore: no setState-in-effect, and the server snapshot
// assumes online so the static HTML never ships with the banner.
function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

/**
 * Registers the service worker (production builds only — in dev it would serve stale chunks
 * over HMR), prompts when an update is waiting, and shows a small offline notice.
 */
export function PwaRegister() {
  const online = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const sw = navigator.serviceWorker;
    // Only reload when the user asked for it. This also ignores the controllerchange fired by
    // clients.claim() on the very first install, and the flag stops a second reload (loop guard).
    let userAcceptedUpdate = false;
    let reloading = false;
    const onControllerChange = () => {
      if (!userAcceptedUpdate || reloading) return;
      reloading = true;
      window.location.reload();
    };
    sw.addEventListener('controllerchange', onControllerChange);

    const promptUpdate = (worker: ServiceWorker) => {
      toast('Update available', {
        id: UPDATE_TOAST_ID,
        description: 'A new version of BetTrack is ready.',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => {
            userAcceptedUpdate = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    let cancelled = false;
    sw.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (cancelled) return;
        // An update may already be waiting from a previous visit.
        if (registration.waiting && sw.controller) promptUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // "installed" with an existing controller = an update, not the first install.
            if (installing.state === 'installed' && sw.controller) promptUpdate(installing);
          });
        });
      })
      .catch((error: unknown) => {
        // Offline support is an enhancement: the app works without it, so log instead of toasting.
        console.warn('Service worker registration failed', error);
      });

    return () => {
      cancelled = true;
      sw.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return (
    // The live region stays mounted so screen readers announce the notice when it appears.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-4 lg:pl-64"
    >
      {online ? null : (
        <p className="rounded-full border border-border bg-surface/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          Offline — your data is saved on this device.
        </p>
      )}
    </div>
  );
}
