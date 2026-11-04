import { describe, expect, it } from 'vitest';
import { historyToCsv } from '@/lib/io/csv';
import { computeTimeline } from '@/lib/calculations/timeline';
import type { Round, Session } from '@/types';

const round = (result: 'win' | 'lose', note?: string): Round => ({
  id: crypto.randomUUID(), result, bet: '4', multiplier: '2.03', createdAt: '2026-11-04T10:00:00.000Z',
  ...(note !== undefined ? { note } : {}),
});
const sessionWith = (rounds: Round[]): Session => ({
  id: 's1', name: 'S', currency: 'USDT', initialBalance: '16.99', defaultBet: '4', defaultMultiplier: '2.03',
  rounds, tags: [], createdAt: '2026-11-04T09:00:00.000Z', updatedAt: '2026-11-04T09:00:00.000Z',
});
const sessionWithNote = (note: string) => sessionWith([round('win', note)]);

describe('historyToCsv', () => {
  it('escapes quotes and commas per RFC 4180', () => {
    const s = sessionWithNote('a "b", c');
    const csv = historyToCsv(s, computeTimeline(s.initialBalance, s.rounds));
    expect(csv.split('\n')[1]).toContain('"a ""b"", c"');
  });
  it('has header, unrounded values, chronological order', () => {
    const s = sessionWith([round('win'), round('lose')]);
    const lines = historyToCsv(s, computeTimeline(s.initialBalance, s.rounds)).trim().split(/\r?\n/);
    expect(lines[0]).toBe('Round,Result,Bet,Multiplier,ProfitLoss,Balance,Time,Note');
    expect(lines[1]).toBe('1,Win,4,2.03,4.12,21.11,2026-11-04T10:00:00.000Z,');
    expect(lines[2]!.startsWith('2,Lose,4,2.03,-4,17.11')).toBe(true);
  });
});
