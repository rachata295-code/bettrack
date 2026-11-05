import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const source = readFileSync(path.join(root, 'public/sw.js'), 'utf8');

type StrategyFor = (method: string, url: string, mode: string, origin: string) => string;

// sw.js is a classic worker script, so run it in a sandbox with a fake `self` and read back its
// top-level function declarations (they become properties of the sandbox global).
function loadWorker() {
  const listeners: string[] = [];
  const sandbox = {
    URL,
    self: { addEventListener: (type: string) => listeners.push(type) },
  } as Record<string, unknown>;
  vm.runInNewContext(source, sandbox);
  return { strategyFor: sandbox.strategyFor as StrategyFor, listeners };
}

const ORIGIN = 'https://bettrack.example';

describe('service worker', () => {
  const { strategyFor, listeners } = loadWorker();

  it('registers install, activate, message and fetch handlers', () => {
    expect(listeners.sort()).toEqual(['activate', 'fetch', 'install', 'message']);
  });

  it('uses a versioned cache name', () => {
    expect(source).toMatch(/const CACHE = 'bettrack-v1';/);
  });

  it('routes requests to the documented strategies', () => {
    expect(strategyFor('GET', `${ORIGIN}/calculator`, 'navigate', ORIGIN)).toBe('navigate');
    expect(strategyFor('GET', `${ORIGIN}/_next/static/chunks/a.js`, 'no-cors', ORIGIN)).toBe('static');
    expect(strategyFor('GET', `${ORIGIN}/icons/icon-192.png`, 'no-cors', ORIGIN)).toBe('swr');
    expect(strategyFor('GET', `${ORIGIN}/calculator.txt?_rsc=1`, 'cors', ORIGIN)).toBe('swr');
  });

  it('never intercepts non-GET or cross-origin requests', () => {
    expect(strategyFor('POST', `${ORIGIN}/`, 'navigate', ORIGIN)).toBe('ignore');
    expect(strategyFor('GET', 'https://fonts.example/x.woff2', 'cors', ORIGIN)).toBe('ignore');
    expect(strategyFor('GET', 'https://cdn.example/', 'navigate', ORIGIN)).toBe('ignore');
  });

  it('precaches every app route', () => {
    // Every folder under app/(app) is a page route; "/" is the (app)/page.tsx itself.
    const routes = readdirSync(path.join(root, 'app/(app)'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}`);
    for (const route of ['/', ...routes]) expect(source).toContain(`'${route}'`);
  });
});
