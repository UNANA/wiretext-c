import { useEffect, useCallback } from 'react';
import type { KeyboardShortcut } from '../types';

export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, altKey, metaKey } = event;

      // Don't trigger shortcuts when typing in input elements
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      for (const shortcut of shortcuts) {
        const {
          key: shortcutKey,
          ctrl: needCtrl = false,
          shift: needShift = false,
          alt: needAlt = false,
          meta: needMeta = false,
          handler,
        } = shortcut;

        const keyMatch = key.toLowerCase() === shortcutKey.toLowerCase();
        const ctrlMatch = ctrlKey === needCtrl;
        const shiftMatch = shiftKey === needShift;
        const altMatch = altKey === needAlt;
        const metaMatch = metaKey === needMeta;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          event.preventDefault();
          handler(event);
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
