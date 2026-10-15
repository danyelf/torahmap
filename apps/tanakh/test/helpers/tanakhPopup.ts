// The Tanakh's popup for a verse, as the shell draws it.

import { updateSidebar, type PopupView, type SidebarElements } from '@torahmap/shell/sidebar.ts';
import { popupText } from '../../src/popup';
import type { TanakhLayout } from '../../src/types';
import { TEXTS_FILE, type VerseTexts } from '../../src/verseTexts';

export function showVerse(
  elements: SidebarElements,
  verse: TanakhLayout | null,
  { verseTexts, ...view }: PopupView<TanakhLayout> & { verseTexts: VerseTexts | null },
): void {
  const loaded = new Map(verseTexts ? [[TEXTS_FILE, verseTexts]] : []);
  updateSidebar(elements, verse, (v) => popupText(v, loaded, view.overlay), view);
}
