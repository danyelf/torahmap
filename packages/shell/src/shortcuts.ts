import type { Panel } from './frame.ts';

/** The letters of the Find, Find next and Go to shortcuts, each pressed with the platform's main modifier. */
export const SHORTCUT_KEYS = { find: 'f', next: 'g', goTo: 'k' } as const;

/** The panels with a shortcut of their own, and its letter. */
export const PANEL_SHORTCUTS: Partial<Record<Panel, string>> = {
  search: SHORTCUT_KEYS.find,
  goto: SHORTCUT_KEYS.goTo,
};

/** Whether Command, not Control, is the main modifier. */
export function onMac(platform: string): boolean {
  return /Mac|iPhone|iPad/.test(platform);
}

/** A letter as printed on its key. */
export const keyCap = (letter: string): string => letter.toUpperCase();

/** A shortcut as the platform writes it: ⌘F on a Mac, Ctrl+F elsewhere. */
export function shortcutLabel(letter: string, mac: boolean): string {
  return mac ? `⌘${letter.toUpperCase()}` : `Ctrl+${letter.toUpperCase()}`;
}
