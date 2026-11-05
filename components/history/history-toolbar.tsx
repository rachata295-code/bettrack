'use client';

import { useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Download, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TimelineRow } from '@/lib/calculations/timeline';
import type { HistoryQuery } from '@/lib/history-query';
import { downloadText } from '@/lib/io/download';
import { exportFilename } from '@/lib/io/filename';
import { historyToCsv } from '@/lib/io/csv';
import { sessionToJson } from '@/lib/io/backup';
import { useBetStore } from '@/store/bet-store';
import type { Session } from '@/types';

interface Props {
  query: HistoryQuery;
  onChange: (q: HistoryQuery) => void;
  session: Session;
  timeline: TimelineRow[];
  onUndo: () => void;
}

const RESULT_ITEMS = [
  { value: 'all', label: 'All results' },
  { value: 'win', label: 'Wins' },
  { value: 'lose', label: 'Losses' },
];
const SORT_ITEMS = [
  { value: 'time', label: 'Time' },
  { value: 'result', label: 'Result' },
  { value: 'bet', label: 'Bet' },
  { value: 'pnl', label: 'P&L' },
];

export function HistoryToolbar({ query, onChange, session, timeline, onUndo }: Props) {
  const empty = session.rounds.length === 0;
  const set = (patch: Partial<HistoryQuery>) => onChange({ ...query, ...patch });

  const exportAs = (kind: 'csv' | 'json') => {
    try {
      if (kind === 'csv') downloadText(exportFilename(session.name, 'csv'), historyToCsv(session, timeline), 'text/csv;charset=utf-8');
      else downloadText(exportFilename(session.name, 'json'), sessionToJson(session), 'application/json');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="col-span-2 space-y-1 md:col-span-2">
          <Label htmlFor="h-search">Search</Label>
          <Input id="h-search" value={query.search} onChange={e => set({ search: e.target.value })} placeholder="Note or #round" autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label>Result</Label>
          <Select items={RESULT_ITEMS} value={query.result} onValueChange={v => set({ result: v as HistoryQuery['result'] })}>
            <SelectTrigger className="w-full" aria-label="Filter by result"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESULT_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-from">From</Label>
          <Input id="h-from" type="date" value={query.from ?? ''} max={query.to || undefined} onChange={e => set({ from: e.target.value || undefined })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-to">To</Label>
          <Input id="h-to" type="date" value={query.to ?? ''} min={query.from || undefined} onChange={e => set({ to: e.target.value || undefined })} />
        </div>
        <div className="space-y-1">
          <Label>Sort by</Label>
          <div className="flex gap-1">
            <Select items={SORT_ITEMS} value={query.sort} onValueChange={v => set({ sort: v as HistoryQuery['sort'] })}>
              <SelectTrigger className="w-full" aria-label="Sort by"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label={query.dir === 'asc' ? 'Sort ascending, switch to descending' : 'Sort descending, switch to ascending'}
              onClick={() => set({ dir: query.dir === 'asc' ? 'desc' : 'asc' })}
            >
              {query.dir === 'asc' ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onUndo} disabled={empty}><Undo2 /> Undo last</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={empty} />}>
            <Download /> Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => exportAs('csv')}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAs('json')}>Export JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ClearSession session={session} disabled={empty} />
      </div>
    </div>
  );
}

function ClearSession({ session, disabled }: { session: Session; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed === session.name;
  return (
    <>
      <Button variant="destructive" disabled={disabled} onClick={() => { setTyped(''); setOpen(true); }}>
        <Trash2 /> Clear session
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all rounds?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all {session.rounds.length} rounds from this session and cannot be undone. Type the session name
              <strong className="mx-1 text-foreground">{session.name}</strong>
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            id="clear-session-form"
            onSubmit={e => {
              e.preventDefault();
              if (!matches) return;
              useBetStore.getState().clearSession(session.id);
              setOpen(false);
              toast('Session cleared');
            }}
          >
            <Label htmlFor="clear-confirm" className="sr-only">Session name</Label>
            <Input id="clear-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" placeholder={session.name} />
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" form="clear-session-form" variant="destructive" disabled={!matches}>Clear session</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
