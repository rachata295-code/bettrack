import { describe, expect, it } from 'vitest';
import { dayCellLabel, dayLabel, heatLevel, monthGrid, monthLabel, monthMaxAbs, shiftMonth } from '@/lib/calculations/calendar';
import type { BucketSummary } from '@/lib/calculations/periods';

describe('monthGrid', () => {
  it('November 2026 starts on Sunday: six Monday-first pads', () => {
    const g = monthGrid('2026-11');
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g[1]![0]).toBe('2026-11-02');
    expect(g.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    g.forEach(w => expect(w).toHaveLength(7));
  });
  it('month starting on Monday has no leading pad', () => {
    // 2026-06-01 is a Monday.
    expect(monthGrid('2026-06')[0]![0]).toBe('2026-06-01');
  });
  it('handles leap February', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean).at(-1)).toBe('2028-02-29');
    expect(monthGrid('2026-02').flat().filter(Boolean).at(-1)).toBe('2026-02-28');
  });
  it('invalid input yields an empty grid', () => {
    expect(monthGrid('2026-13')).toEqual([]);
    expect(monthGrid('nope')).toEqual([]);
  });
});

describe('heatLevel', () => {
  it('zero or no scale is level 0', () => {
    expect(heatLevel('0', '10')).toBe(0);
    expect(heatLevel('5', '0')).toBe(0);
  });
  it('scales |pnl| against max into 1..4 with sign', () => {
    expect(heatLevel('10', '10')).toBe(4);
    expect(heatLevel('-10', '10')).toBe(-4);
    expect(heatLevel('0.01', '10')).toBe(1);
    expect(heatLevel('5', '10')).toBe(2);
    expect(heatLevel('-5.01', '10')).toBe(-3);
    expect(heatLevel('7.5', '10')).toBe(3);
  });
  it('clamps values beyond max', () => expect(heatLevel('-20', '10')).toBe(-4));
});

describe('monthMaxAbs', () => {
  it('takes the largest |pnl| among days of the month only', () => {
    const b = [
      { key: '2026-10-31', pnl: '-99' }, { key: '2026-11-01', pnl: '3' }, { key: '2026-11-02', pnl: '-4.5' },
    ] as BucketSummary[];
    expect(monthMaxAbs(b, '2026-11')).toBe('4.5');
    expect(monthMaxAbs([], '2026-11')).toBe('0');
  });
});

describe('labels', () => {
  it('shiftMonth crosses years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-11', 0)).toBe('2026-11');
  });
  it('month and day labels', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(dayLabel('2026-11-04')).toBe('4 Nov 2026');
  });
  it('dayCellLabel follows the brief format', () => {
    const b = { key: '2026-11-04', pnl: '4.12', rounds: 3 } as BucketSummary;
    expect(dayCellLabel('2026-11-04', b, 'USDT', 2)).toBe('4 Nov 2026: +4.12 USDT, 3 rounds');
    expect(dayCellLabel('2026-11-04', { ...b, pnl: '-4', rounds: 1 }, 'THB', 2)).toBe('4 Nov 2026: −4.00 THB, 1 round');
    expect(dayCellLabel('2026-11-04', undefined, 'USDT', 2)).toBe('4 Nov 2026: no rounds');
  });
});
