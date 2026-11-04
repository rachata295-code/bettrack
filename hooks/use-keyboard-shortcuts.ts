'use client';

import { useEffect, useRef } from 'react';
import { resolveShortcut, type ShortcutAction } from '@/lib/shortcuts';

export function useKeyboardShortcuts(handlers: Partial<Record<ShortcutAction, () => void>>): void {
  // Ref keeps the listener stable while always calling the latest closures.
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      const action = resolveShortcut({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        targetTag: el?.tagName ?? 'BODY',
        targetEditable: el?.isContentEditable ?? false,
      });
      const fn = action ? ref.current[action] : undefined;
      if (!action || !fn) return;
      // Stops the shortcut letter being typed into a field we are about to focus; held keys must not repeat bets.
      e.preventDefault();
      if (e.repeat) return;
      fn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
