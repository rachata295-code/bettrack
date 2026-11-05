'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/calculations/money';
import { computeSessionStats } from '@/lib/calculations/stats';
import { computeTimeline } from '@/lib/calculations/timeline';
import { cn } from '@/lib/utils';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import type { Session } from '@/types';
import { SessionFormDialog } from './session-form-dialog';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function SessionList() {
  const sessions = useBetStore(s => s.sessions);
  const activeId = useBetStore(s => s.activeSessionId);
  const precision = useSettingsStore(s => s.precision);
  const [editing, setEditing] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [sessions]);

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {sorted.map(s => {
          const stats = computeSessionStats(s.initialBalance, computeTimeline(s.initialBalance, s.rounds));
          const isActive = s.id === activeId;
          const pnlClass = stats.netPnl.startsWith('-') ? 'text-loss' : stats.netPnl === '0' ? '' : 'text-profit';
          return (
            <li key={s.id}>
              <Card className={cn(isActive && 'ring-2 ring-accent')}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{s.name}</h2>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline">{s.currency}</Badge>
                        {s.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                      </div>
                    </div>
                    {isActive && <Badge>Active</Badge>}
                  </div>

                  <dl className="num grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Balance</dt>
                      <dd className="font-medium">{formatMoney(stats.current, { precision })}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Net P&amp;L</dt>
                      <dd className={cn('font-medium', pnlClass)}>{formatMoney(stats.netPnl, { precision, signed: true })}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Rounds</dt>
                      <dd className="font-medium">{stats.rounds}</dd>
                    </div>
                  </dl>

                  <p className="text-xs text-muted-foreground">Created {fmtDate(s.createdAt)} · Updated {fmtDate(s.updatedAt)}</p>

                  <div className="flex flex-wrap gap-2">
                    {!isActive && (
                      <Button size="sm" onClick={() => useBetStore.getState().setActiveSession(s.id)}>Switch</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting(s)}><Trash2 /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <SessionFormDialog mode="edit" session={editing ?? undefined} open={editing !== null} onOpenChange={o => { if (!o) setEditing(null); }} />

      <AlertDialog open={deleting !== null} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <strong className="text-foreground">{deleting.name}</strong> and its {deleting.rounds.length} rounds will be
                  permanently deleted. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  useBetStore.getState().deleteSession(deleting.id);
                  toast(`Deleted "${deleting.name}"`);
                }
                setDeleting(null);
              }}
            >
              Delete session
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
