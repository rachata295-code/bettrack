// Browser-only helper; no-op during SSR where `document` does not exist.
export function downloadText(filename: string, text: string, mime: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke so the blob is not leaked for the lifetime of the page.
    URL.revokeObjectURL(url);
  }
}
