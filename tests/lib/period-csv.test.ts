import { describe, expect, it } from 'vitest';
import { bucketsToCsv } from '@/lib/io/period-csv';
import { summaryFilename } from '@/lib/io/filename';
import type { BucketSummary } from '@/lib/calculations/periods';

const bucket = (over: Partial<BucketSummary> = {}): BucketSummary => ({
  key: '2026-11-04', rounds: 3, wins: 2, losses: 1, winRatePct: '66.666666666666666667',
  wagered: '12', payouts: '16.24', pnl: '4.24', roiPct: '35.333333333333333333',
  maxDrawdown: '4', chasing: 1, playMinutes: 65, ...over,
});

describe('bucketsToCsv', () => {
  it('starts with a UTF-8 BOM and the fixed header', () => {
    const csv = bucketsToCsv([bucket()], 'day');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'Period,Rounds,Wins,Losses,WinRatePct,Wagered,Payouts,PnL,ROIPct,MaxDrawdown,Chasing,PlayMinutes',
    );
  });
  it('writes unrounded values in bucket order with CRLF line ends', () => {
    const lines = bucketsToCsv([bucket(), bucket({ key: '2026-11-05', pnl: '-4', rounds: 1 })], 'day').slice(1).split('\r\n');
    expect(lines[1]).toBe('2026-11-04,3,2,1,66.666666666666666667,12,16.24,4.24,35.333333333333333333,4,1,65');
    expect(lines[2]!.startsWith('2026-11-05,1,')).toBe(true);
    expect(lines[2]).toContain(',-4,');
    expect(lines[3]).toBe('');
  });
  it('escapes fields per RFC 4180', () => {
    const csv = bucketsToCsv([bucket({ key: 'a "b", c' })], 'week');
    expect(csv).toContain('\r\n"a ""b"", c",');
  });
  it('appends Deposits,Withdrawals at the end only when wallet totals are given', () => {
    const csv = bucketsToCsv([bucket(), bucket({ key: '2026-11-05' })], 'day', { '2026-11-04': { deposits: '10.5', withdrawals: '3' } });
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Period,Rounds,Wins,Losses,WinRatePct,Wagered,Payouts,PnL,ROIPct,MaxDrawdown,Chasing,PlayMinutes,Deposits,Withdrawals');
    expect(lines[1]!.endsWith(',65,10.5,3')).toBe(true);
    expect(lines[2]!.endsWith(',65,0,0')).toBe(true);
  });
  it('header only for no buckets', () => {
    expect(bucketsToCsv([], 'month').slice(1).trim().split('\r\n')).toHaveLength(1);
  });
});

describe('summaryFilename', () => {
  const d = new Date(2026, 10, 4, 9);
  it('names by unit and local date', () => {
    expect(summaryFilename('day', d)).toBe('bettrack-day-summary-20261104.csv');
    expect(summaryFilename('week', d)).toBe('bettrack-week-summary-20261104.csv');
    expect(summaryFilename('month', d)).toBe('bettrack-month-summary-20261104.csv');
  });
});
