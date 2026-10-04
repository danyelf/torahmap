// Sidebar management for verse details display

import type { TanakhLayout, TextLanguage } from './types.ts';
import { ENGLISH, HEBREW } from './types.ts';
import type { TanakhOverlay, TanakhTool } from './overlays/index.ts';
import { getVerseText, type VerseTexts } from './verseTexts.ts';
import { sefariaUrl } from './sefaria.ts';
import { verseWords, wrapWordsInFragment } from './verseWords.ts';
import { combineMarks } from './verseMarks.ts';
import { verseRef } from '@torahmap/link';

/** A click on a word in the verse popup's Hebrew text. */
export interface WordClick {
  /** The word exactly as displayed, points and all. */
  text: string;
  /** Its position among the verse's words. */
  index: number;
  /** The verse's Hebrew, the text `index` counts in. */
  hebrew: string;
  book: string;
  chapter: number;
  verse: number;
  /** The span that was clicked, for anchoring a popover. */
  element: HTMLElement;
}

/** A fragment holding just a text node, for text no overlay has marked up. */
function textFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.createTextNode(text));
  return fragment;
}

function infoLine(line: HTMLElement | string): HTMLElement {
  if (typeof line !== 'string') return line;
  const div = document.createElement('div');
  div.textContent = line;
  return div;
}

let wordClickHandler: ((click: WordClick) => void) | null = null;

/**
 * Listen for clicks on words in the verse popup.
 *
 * The sidebar reports which word was clicked and leaves the meaning of that to
 * the caller, so that the Hebrew stays clickable whatever overlay is active.
 */
export function setWordClickHandler(handler: ((click: WordClick) => void) | null): void {
  wordClickHandler = handler;
}

/** One listener on the container, so re-rendering the verse cannot pile them up. */
function attachWordClicks(container: HTMLElement, text: string, verse: TanakhLayout): void {
  const words = verseWords(text);

  container.onclick = (event) => {
    if (!wordClickHandler) return;

    const span = (event.target as HTMLElement)?.closest?.('.verse-word');
    if (!(span instanceof HTMLElement)) return;

    const index = Number(span.dataset.wordIndex);
    const word = words[index];
    if (!word) return;

    wordClickHandler({
      text: word.word,
      index,
      hebrew: text,
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      element: span,
    });
  };
}

export interface SidebarElements {
  sidebar: HTMLElement | null;
  ref: Element | null;
  overlayInfo: Element | null;
  hebrew: Element | null;
  /** Where the popup says the texts are loading or failed, apart from the text. */
  notice: Element | null;
  english: Element | null;
  link: HTMLAnchorElement | null;
  closeBtn: Element | null;
}

export function getSidebarElements(): SidebarElements {
  const sidebar = document.getElementById('verse-popup');

  return {
    sidebar,
    ref: sidebar?.querySelector('.ref-text') ?? null,
    overlayInfo: sidebar?.querySelector('.overlay-info') ?? null,
    hebrew: sidebar?.querySelector('.verse-hebrew') ?? null,
    notice: sidebar?.querySelector('.verse-notice') ?? null,
    english: sidebar?.querySelector('.verse-english') ?? null,
    link: (sidebar?.querySelector('.sefaria-link') as HTMLAnchorElement) ?? null,
    closeBtn: sidebar?.querySelector('.close-btn') ?? null,
  };
}

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

/** What the popup shows beside the verse, and whether the verse is pinned. */
export interface PopupView {
  /** Null until the texts file is in. */
  verseTexts: VerseTexts | null;
  /** Shown while the texts are not in. */
  textsNotice: Node | null;
  /** Whether a Hebrew word opens its menu when clicked: only once search has its data. */
  wordsClickable: boolean;
  overlay: TanakhTool | null;
  search: TanakhTool | null;
  pinned: boolean;
}

export function updateSidebar(
  elements: SidebarElements,
  verse: TanakhLayout | null,
  view: PopupView,
): void {
  const { sidebar, ref, overlayInfo, hebrew, notice, english, link } = elements;
  const { verseTexts, textsNotice, wordsClickable, search, pinned: isPinned } = view;
  const currentOverlay = view.overlay?.tool ?? null;
  const overlaySettings = view.overlay?.settings;
  const overlayData = view.overlay?.data;

  if (!sidebar) return;

  if (!verse) {
    sidebar.classList.remove('visible');
    sidebar.classList.remove('pinned');
    return;
  }

  const text = verseTexts && getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);

  if (ref) {
    ref.textContent = verseRef(verse);
  }
  if (overlayInfo) {
    const lines = [
      currentOverlay?.renderSidebarInfo?.(verse, isPinned, overlaySettings, overlayData) ??
        currentOverlay?.getHoverInfo?.(verse, overlaySettings, overlayData),
      search?.tool.getHoverInfo?.(verse, search.settings, search.data),
    ].filter((line): line is HTMLElement | string => !!line);
    overlayInfo.replaceChildren(...lines.map(infoLine));
  }

  // Both tools mark the text; where they mark the same letters, the search's mark is kept.
  const marked = (text: string, language: TextLanguage): DocumentFragment | null => {
    const overlayMarks = currentOverlay?.highlightVerseText?.(
      verse,
      text,
      language,
      overlaySettings,
      overlayData,
    );
    const searchMarks = search?.tool.highlightVerseText?.(
      verse,
      text,
      language,
      search.settings,
      search.data,
    );
    if (overlayMarks && searchMarks) return combineMarks(text, overlayMarks, searchMarks);
    return searchMarks ?? overlayMarks ?? null;
  };
  if (hebrew) {
    const container = hebrew as HTMLElement;
    container.onclick = null;
    if (!text) {
      container.replaceChildren();
    } else {
      const fragment = marked(text.he, HEBREW) ?? textFragment(text.he);
      if (wordsClickable) {
        // Whatever the overlay produced, words are wrapped afterwards, so a click
        // finds a word whether or not anything is highlighting the text.
        container.replaceChildren(wrapWordsInFragment(fragment, text.he));
        attachWordClicks(container, text.he, verse);
      } else {
        container.replaceChildren(fragment);
      }
    }
  }
  notice?.replaceChildren(...(textsNotice ? [textsNotice] : []));
  if (english) {
    const highlighted = text && marked(text.en, ENGLISH);
    if (highlighted) english.replaceChildren(highlighted);
    else english.textContent = text?.en ?? '';
  }
  if (link) {
    link.href = getSefariaUrl(
      verse.book,
      verse.chapter,
      verse.verse,
      currentOverlay,
      overlaySettings,
    );
  }

  sidebar.classList.add('visible');
  if (isPinned) {
    sidebar.classList.add('pinned');
  } else {
    sidebar.classList.remove('pinned');
  }
}
