/**
 * RFC 4122 v4 id. crypto.randomUUID only exists in secure contexts, so opening `pnpm dev`
 * over plain http on a LAN IP (e.g. from a phone) would otherwise crash at store load.
 */
export function newId(): string {
  const c = typeof globalThis.crypto === 'undefined' ? undefined : globalThis.crypto;
  if (typeof c?.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // fall through to the manual paths
    }
  }
  const bytes = new Uint8Array(16);
  let filled = false;
  if (typeof c?.getRandomValues === 'function') {
    try {
      c.getRandomValues(bytes);
      filled = true;
    } catch {
      // fall through
    }
  }
  // Last resort: ids only need to be unique locally, not unguessable.
  if (!filled) for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
