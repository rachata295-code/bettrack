import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

const root = path.resolve(import.meta.dirname, '../..');
const publicPath = (src: string) => path.join(root, 'public', src);

// Reads width/height from the PNG IHDR chunk so a mislabelled `sizes` is caught.
function pngSize(file: string): string {
  const buf = readFileSync(file);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

describe('web app manifest', () => {
  const m = manifest();

  it('describes an installable standalone app', () => {
    expect(m.name).toBe('BetTrack');
    expect(m.short_name).toBe('BetTrack');
    expect(m.description).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toBe('#09090B');
    expect(m.theme_color).toBe('#09090B');
  });

  it('lists 192 and 512 icons plus a separate maskable icon', () => {
    const icons = m.icons ?? [];
    const any = icons.filter((i) => (i.purpose ?? 'any') === 'any');
    const maskable = icons.filter((i) => i.purpose === 'maskable');
    expect(any.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    expect(maskable.map((i) => i.sizes)).toEqual(['512x512']);
  });

  it('points every icon at a real PNG of the declared size', () => {
    for (const icon of manifest().icons ?? []) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(icon.type).toBe('image/png');
      const file = publicPath(icon.src.slice(1));
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file)).toBe(icon.sizes);
    }
  });

  it('ships a 180x180 apple-touch-icon', () => {
    const file = publicPath('icons/apple-touch-icon.png');
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)).toBe('180x180');
  });
});
