import type { MetadataRoute } from 'next';

// Static export needs metadata routes to be explicitly static so they are emitted into out/.
export const dynamic = 'force-static';

// Theme/background match the app's single dark theme so the splash screen doesn't flash white.
const APP_BG = '#09090B';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BetTrack',
    short_name: 'BetTrack',
    description: 'Track your own betting balance and results. Data stays on this device.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: APP_BG,
    theme_color: APP_BG,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate maskable entry: its artwork sits inside the 80% safe zone, which would look too small as "any".
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
