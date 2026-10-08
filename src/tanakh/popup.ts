// What the Tanakh's popup says of a verse.

import { verseRef } from '@torahmap/link';
import type { TanakhOverlay, TanakhTool } from '../overlays/index.ts';
import { sefariaUrl } from '../sefaria.ts';
import type { PopupText } from '../sidebar.ts';
import type { TanakhLayout } from '../types.ts';
import { getVerseText, type VerseTexts } from '../verseTexts.ts';

/**
 * Build the Sefaria URL for a verse.
 *
 * If the current overlay has an opinion (e.g. commentary's selected
 * category), opens Sefaria to that connection type. Otherwise opens to all
 * connections (?with=all).
 */
export function getSefariaUrl(
  book: string,
  chapter: number,
  verse: number,
  currentOverlay: TanakhOverlay | null = null,
  overlaySettings: unknown = undefined,
): string {
  const param = currentOverlay?.getSefariaConnectionParam?.(overlaySettings) ?? 'all';
  return `${sefariaUrl(book, [chapter, verse])}?with=${encodeURIComponent(param)}`;
}

/** `texts` is null until the texts file is in. */
export function popupText(
  verse: TanakhLayout,
  texts: VerseTexts | null,
  overlay: TanakhTool | null,
): PopupText {
  const text = texts && getVerseText(texts, verse.book, verse.chapter, verse.verse);
  return {
    ref: verseRef(verse),
    hebrew: text?.he ?? '',
    english: text?.en ?? '',
    link: getSefariaUrl(
      verse.book,
      verse.chapter,
      verse.verse,
      overlay?.tool ?? null,
      overlay?.settings,
    ),
  };
}
