/** bettrack-<session-name>-<YYYYMMDD>.<ext>, using the browser's local date. */
export function exportFilename(sessionName: string, ext: 'csv' | 'json', now: Date = new Date()): string {
  // Session names are free text; drop path/reserved characters but keep any script's letters,
  // digits and combining marks (\p{M}: Thai vowels/tone marks) so Thai names survive.
  const safe = sessionName.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'session';
  const p = (n: number) => String(n).padStart(2, '0');
  return `bettrack-${safe}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.${ext}`;
}
