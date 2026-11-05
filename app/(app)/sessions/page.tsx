'use client';

import { useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ImportDialog } from '@/components/sessions/import-dialog';
import { SessionFormDialog } from '@/components/sessions/session-form-dialog';
import { SessionList } from '@/components/sessions/session-list';
import { Button } from '@/components/ui/button';
import { createBackup } from '@/lib/io/backup';
import { downloadText } from '@/lib/io/download';
import { exportFilename } from '@/lib/io/filename';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';

export default function SessionsPage() {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportAll = () => {
    try {
      const { sessions } = useBetStore.getState();
      const { precision } = useSettingsStore.getState();
      downloadText(exportFilename('backup', 'json'), JSON.stringify(createBackup(sessions, { precision }), null, 2), 'application/json');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)}><Plus /> New session</Button>
        <Button variant="outline" onClick={exportAll}><Download /> Export all</Button>
        <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import</Button>
      </div>
      <SessionList />
      <SessionFormDialog mode="create" open={creating} onOpenChange={setCreating} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}
