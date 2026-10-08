// The Tanakh's popup for a verse, as the shell draws it.

import { updateSidebar, type PopupView, type SidebarElements } from '../../sidebar';
import { popupText } from '../../tanakh/popup';
import type { TanakhLayout } from '../../types';
import type { VerseTexts } from '../../verseTexts';

export function showVerse(
  elements: SidebarElements,
  verse: TanakhLayout | null,
  view: PopupView<TanakhLayout> & { verseTexts: VerseTexts | null },
): void {
  const shown = verse && { item: verse, text: popupText(verse, view.verseTexts, view.overlay) };
  updateSidebar(elements, shown, view);
}
