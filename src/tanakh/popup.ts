// What the Tanakh's popup says of a verse.

import { verseRef } from '@torahmap/link';
import type { Loaded } from '../dataFiles.ts';
import type { TanakhTool } from '../overlays/index.ts';
import { sefariaUrl } from '../sefaria.ts';
import type { PopupText } from '../sidebar.ts';
import type { TanakhLayout } from '../types.ts';
import { getVerseText, textsFrom } from '../verseTexts.ts';

/** Opens Sefaria to the overlay's connection type, or to all of them. */
export function getSefariaUrl(verse: TanakhLayout, overlay: TanakhTool | null): string {
  const param = overlay?.tool.getSefariaConnectionParam?.(overlay.settings) ?? 'all';
  return `${sefariaUrl(verse.book, [verse.chapter, verse.verse])}?with=${encodeURIComponent(param)}`;
}

export function popupText(
  verse: TanakhLayout,
  loaded: Loaded,
  overlay: TanakhTool | null,
): PopupText {
  const texts = textsFrom(loaded);
  const text = texts && getVerseText(texts, verse.book, verse.chapter, verse.verse);
  return {
    ref: verseRef(verse),
    hebrew: text?.he ?? '',
    english: text?.en ?? '',
    link: getSefariaUrl(verse, overlay),
  };
}
