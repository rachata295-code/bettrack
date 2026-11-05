export type ShortcutAction = 'win' | 'lose' | 'undo' | 'focusBet' | 'focusMultiplier' | 'help';

export interface ShortcutEvent {
  key: string;
  code: string; // physical key (KeyboardEvent.code), layout-independent
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  targetTag: string;
  targetEditable: boolean;
}

const KEY_MAP: Record<string, ShortcutAction> = {
  w: 'win',
  l: 'lose',
  u: 'undo',
  b: 'focusBet',
  m: 'focusMultiplier',
  '?': 'help',
};

// Physical-key fallback for non-Latin layouts (e.g. Thai, where the W key types "ไ").
const CODE_MAP: Record<string, ShortcutAction> = {
  KeyW: 'win',
  KeyL: 'lose',
  KeyU: 'undo',
  KeyB: 'focusBet',
  KeyM: 'focusMultiplier',
};
const LATIN_LETTER = /^[a-z]$/i;

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Maps a key event to an action; null when the user is typing or using a browser/OS shortcut. */
export function resolveShortcut(e: ShortcutEvent): ShortcutAction | null {
  // Modifier combos (Cmd+L, Ctrl+W...) belong to the browser, and typing must never trigger a bet.
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.targetEditable || TYPING_TAGS.has(e.targetTag.toUpperCase())) return null;
  const byKey = KEY_MAP[e.key.toLowerCase()];
  if (byKey) return byKey;
  // Only when the key isn't a Latin letter: on AZERTY "z" sits on KeyW and must not record a win.
  if (LATIN_LETTER.test(e.key)) return null;
  if (e.code === 'Slash' && e.shiftKey) return 'help';
  return CODE_MAP[e.code] ?? null;
}

export const SHORTCUT_HELP: { keys: string; label: string }[] = [
  { keys: 'W', label: 'Record a win' },
  { keys: 'L', label: 'Record a loss' },
  { keys: 'U', label: 'Undo last round' },
  { keys: 'B', label: 'Focus bet' },
  { keys: 'M', label: 'Focus multiplier' },
  { keys: '?', label: 'Show shortcuts' },
];
