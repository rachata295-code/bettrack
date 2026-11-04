import type { TimelineRow } from '@/lib/calculations/timeline';
import { D } from '@/lib/calculations/money';

export interface HistoryQuery {
  search: string;
  result: 'all' | 'win' | 'lose';
  from?: string; // YYYY-MM-DD, local date
  to?: string; // YYYY-MM-DD, local date
  sort: 'time' | 'result' | 'bet' | 'pnl';
  dir: 'asc' | 'desc';
}

export const DEFAULT_HISTORY_QUERY: HistoryQuery = { search: '', result: 'all', sort: 'time', dir: 'desc' };

// Local calendar date (browser timezone); M2 switches this to Asia/Bangkok via periods.ts.
function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function compare(a: TimelineRow, b: TimelineRow, sort: HistoryQuery['sort']): number {
  switch (sort) {
    case 'time':
      return a.index - b.index; // array order is chronological
    case 'result':
      return Number(a.round.result === 'win') - Number(b.round.result === 'win');
    case 'bet':
      return D(a.round.bet).cmp(D(b.round.bet));
    case 'pnl':
      return D(a.pnl).cmp(D(b.pnl));
  }
}

export function queryHistory(rows: readonly TimelineRow[], q: HistoryQuery): TimelineRow[] {
  const term = q.search.trim().toLowerCase();
  const num = term.replace(/^#/, '');
  const filtered = rows.filter(r => {
    if (q.result !== 'all' && r.round.result !== q.result) return false;
    if (term) {
      const inNote = (r.round.note ?? '').toLowerCase().includes(term);
      const isRound = /^\d+$/.test(num) && String(r.index) === num;
      if (!inNote && !isRound) return false;
    }
    if (q.from || q.to) {
      const d = localDate(r.round.createdAt);
      if (q.from && d < q.from) return false;
      if (q.to && d > q.to) return false;
    }
    return true;
  });
  const sign = q.dir === 'asc' ? 1 : -1;
  // Ties fall back to ascending index so ordering is stable and predictable.
  return filtered.sort((a, b) => compare(a, b, q.sort) * sign || a.index - b.index);
}
