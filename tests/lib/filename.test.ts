import { describe, expect, it } from 'vitest';
import { exportFilename } from '@/lib/io/filename';

describe('exportFilename', () => {
  const d = new Date(2026, 10, 4, 9);
  it('formats local date', () => expect(exportFilename('Main', 'csv', d)).toBe('bettrack-Main-20261104.csv'));
  it('sanitizes and collapses', () => expect(exportFilename('my  session/v2!!', 'json', d)).toBe('bettrack-my-session-v2-20261104.json'));
  it('falls back', () => expect(exportFilename('กลาง ???', 'csv', d)).toBe('bettrack-session-20261104.csv'));
});
