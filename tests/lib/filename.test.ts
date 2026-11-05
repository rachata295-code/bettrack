import { describe, expect, it } from 'vitest';
import { exportFilename } from '@/lib/io/filename';

describe('exportFilename', () => {
  const d = new Date(2026, 10, 4, 9);
  it('formats local date', () => expect(exportFilename('Main', 'csv', d)).toBe('bettrack-Main-20261104.csv'));
  it('sanitizes and collapses', () => expect(exportFilename('my  session/v2!!', 'json', d)).toBe('bettrack-my-session-v2-20261104.json'));
  it('keeps Thai and other Unicode letters/numbers', () => {
    expect(exportFilename('กลาง ???', 'csv', d)).toBe('bettrack-กลาง-20261104.csv');
    expect(exportFilename('รอบ ๑ / Café', 'json', d)).toBe('bettrack-รอบ-๑-Café-20261104.json');
    // Thai vowel/tone marks are \p{M}; dropping them would turn ชิงชัย into ช-งช-ย.
    expect(exportFilename('ชิงชัย', 'csv', d)).toBe('bettrack-ชิงชัย-20261104.csv');
  });
  it('falls back', () => expect(exportFilename(' ??? / ', 'csv', d)).toBe('bettrack-session-20261104.csv'));
});
