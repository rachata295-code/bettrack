/*
 * BetTrack service worker — hand-written, served as-is from public/ (not bundled).
 *
 * What it caches: only the app shell (HTML pages, /_next/static assets, icons, manifest).
 * User data (bets, sessions, settings) lives in localStorage and is NEVER touched here,
 * so clearing this cache can never lose a user's records.
 *
 * Strategies:
 * - Navigations (HTML pages): network-first so a deploy shows up on the next load; falls back to
 *   the cached page (then to the cached "/" shell) when offline. A short timeout serves the cached
 *   copy on a very slow connection instead of leaving the user on a blank screen; the network
 *   response still refreshes the cache when it arrives.
 * - /_next/static/*: cache-first. Next fingerprints these filenames, so a cached copy never goes stale.
 * - Other same-origin GETs (icons, manifest, RSC payloads): stale-while-revalidate.
 * - Non-GET and cross-origin requests are not intercepted at all.
 *
 * Bump CACHE whenever this file's caching behaviour changes; activate deletes every other cache.
 */

const CACHE = 'bettrack-v1';

// Static export emits /calculator.html etc.; hosts (Vercel, `serve`) answer the clean URL, which is
// also what navigations request, so precache the clean URLs.
const SHELL_ROUTES = [
  '/',
  '/calculator',
  '/history',
  '/analytics',
  '/simulator',
  '/wallet',
  '/sessions',
  '/settings',
];
const SHELL_EXTRAS = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

// How long a navigation waits for the network before showing the cached page (only if one exists).
const NAV_TIMEOUT_MS = 3000;

/**
 * Pure routing decision, kept free of SW APIs so it can be unit-tested.
 * @returns {'ignore' | 'navigate' | 'static' | 'swr'}
 */
function strategyFor(method, url, mode, origin) {
  if (method !== 'GET') return 'ignore';
  const u = new URL(url);
  if (u.origin !== origin) return 'ignore';
  if (mode === 'navigate') return 'navigate';
  if (u.pathname.startsWith('/_next/static/')) return 'static';
  return 'swr';
}

// A redirected response can't be used to answer a navigation, so store a clean copy instead.
async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}

async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, await cleanResponse(response));
  } catch {
    // Quota or storage errors must not break the page; the next request will try again.
  }
}

// Pull /_next/static asset URLs out of a page so the shell works offline even for pages
// whose chunks the user hasn't loaded yet.
function assetUrlsIn(html) {
  const found = html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [];
  return [...new Set(found)];
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  // Pages are required: if any fails, install fails and the browser retries on a later load.
  for (const route of SHELL_ROUTES) {
    const response = await fetch(route, { cache: 'reload' });
    if (!response.ok) throw new Error(`Precache failed for ${route}: ${response.status}`);
    for (const url of assetUrlsIn(await response.clone().text())) assets.add(url);
    await cache.put(route, await cleanResponse(response));
  }
  // Assets and icons are best-effort: a missing one only degrades offline use, never install.
  await Promise.all(
    [...assets, ...SHELL_EXTRAS].map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Ignored: runtime caching will pick it up on first use.
      }
    }),
  );
}

async function handleNavigate(event) {
  const { request } = event;
  // Start the fetch and register the cache refresh before any await: waitUntil must be called
  // while the event is still extendable, and the refresh may finish after we answered from cache.
  const fetched = fetch(request).then((response) => ({
    response,
    copy: isCacheable(response) ? response.clone() : null,
  }));
  event.waitUntil(
    fetched.then(({ copy }) => (copy ? putInCache(request, copy) : undefined)).catch(() => undefined),
  );
  const network = fetched.then(({ response }) => response);

  const cache = await caches.open(CACHE);
  const cached =
    (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/'));

  if (!cached) {
    // Nothing to fall back to: just wait for the network (and let a failure surface as usual).
    return network;
  }

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(cached), NAV_TIMEOUT_MS);
  });
  try {
    return await Promise.race([network, timeout]);
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await putInCache(request, response.clone());
  return response;
}

async function handleSwr(event) {
  const { request } = event;
  const network = fetch(request).then((response) => {
    if (isCacheable(response)) return putInCache(request, response.clone()).then(() => response);
    return response;
  });
  // Registered up front (see handleNavigate); a failed refresh is fine when we answer from cache.
  event.waitUntil(network.catch(() => undefined));
  const cached = await caches.match(request);
  return cached || network;
}

self.addEventListener('install', (event) => {
  // No skipWaiting here: an updated worker waits until the user taps "Reload" in the update toast.
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const strategy = strategyFor(request.method, request.url, request.mode, self.location.origin);
  if (strategy === 'ignore') return;
  if (strategy === 'navigate') event.respondWith(handleNavigate(event));
  else if (strategy === 'static') event.respondWith(handleStatic(request));
  else event.respondWith(handleSwr(event));
});
