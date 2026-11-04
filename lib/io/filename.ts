/** bettrack-<session-name>-<YYYYMMDD>.<ext>, using the browser's local date. */
export function exportFilename(sessionName: string, ext: 'csv' | 'json', now: Date = new Date()): string {
  // Session names are free text; keep filenames portable across OSes.
  const safe = sessionName.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
  const p = (n: number) => String(n).padStart(2, '0');
  return `bettrack-${safe}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.${ext}`;
}
