'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useBetStore } from '@/store/bet-store';
import type { TimelineRow } from '@/lib/calculations/timeline';
import { EditRoundDialog } from './edit-round-dialog';

/** Edit + Delete buttons for one row; shared by the table and the mobile cards. */
export function RoundActions({ row }: { row: TimelineRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" aria-label={`Edit round ${row.index}`} onClick={() => setEditOpen(true)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Delete round ${row.index}`} onClick={() => setDeleteOpen(true)}>
        <Trash2 />
      </Button>
      <EditRoundDialog round={row.round} index={row.index} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete round {row.index}?</AlertDialogTitle>
            <AlertDialogDescription>
              Later rounds stay, and their balances are recalculated without this round.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                useBetStore.getState().deleteRound(row.round.id);
                toast(`Deleted round ${row.index}`);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
