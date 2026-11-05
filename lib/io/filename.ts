/** bettrack-<session-name>-<YYYYMMDD>.<ext>, using the browser's local date. */
export function exportFilename(sessionName: string, ext: 'csv' | 'json', now: Date = new Date()): string {
  // Session names are free text; drop path/reserved characters but keep any script's letters,
  // digits and combining marks (\p{M}: Thai vowels/tone marks) so Thai names survive.
  const safe = sessionName.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'session';
  return `bettrack-${safe}-${ymd(now)}.${ext}`;
}

/** YYYYMMDD in the browser's local date: matches what the user sees on their own clock. */
export function ymd(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
}

/** bettrack-<unit>-summary-<YYYYMMDD>.csv for the Period tab export. */
export function summaryFilename(unit: 'day' | 'week' | 'month', now: Date = new Date()): string {
  return `bettrack-${unit}-summary-${ymd(now)}.csv`;
}
