// The popup for a square: what the text says of it, marked by the overlay and
// the search, with its words clickable for the search.

import type { MapItem, TextLanguage } from './types.ts';
import { ENGLISH, HEBREW } from './types.ts';
import type { ToolOnMap } from './overlays/types.ts';
import { verseWords, wrapWordsInFragment } from './verseWords.ts';
import { combineMarks } from './verseMarks.ts';

/** A click on a word in the popup's Hebrew text. */
export interface WordClick<I extends MapItem = MapItem> {
  /** The word exactly as displayed, points and all. */
  text: string;
  /** Its position among the square's words. */
  index: number;
  /** The square's Hebrew, the text `index` counts in. */
  hebrew: string;
  item: I;
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
 * Listen for clicks on words in the popup.
 *
 * The popup reports which word was clicked and leaves the meaning of that to
 * the caller, so that the Hebrew stays clickable whatever overlay is active.
 */
export function setWordClickHandler<I extends MapItem>(
  handler: ((click: WordClick<I>) => void) | null,
): void {
  // Only this text's squares are ever drawn, so every click is on an I.
  wordClickHandler = handler as ((click: WordClick) => void) | null;
}

/** One listener on the container, so drawing the popup again cannot pile them up. */
function attachWordClicks(
  container: HTMLElement,
  text: string,
  item: MapItem,
  heard: (click: WordClick) => void,
): void {
  const words = verseWords(text);

  container.onclick = (event) => {
    const span = (event.target as HTMLElement)?.closest?.('.verse-word');
    if (!(span instanceof HTMLElement)) return;

    const index = Number(span.dataset.wordIndex);
    const word = words[index];
    if (!word) return;

    heard({
      text: word.word,
      index,
      hebrew: text,
      item,
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

/** What a square's popup says, from its text. The Hebrew and English are empty while its file is not in, or does not hold it. */
export interface PopupText {
  ref: string;
  hebrew: string;
  english: string;
  link: string;
}

/** What the popup shows beside the square's text, and whether the square is pinned. */
export interface PopupView<I extends MapItem> {
  /** Shown while the square's file is not in. */
  textsNotice: Node | null;
  /** Whether search has its data, so a clicked word has a search to join. */
  wordsClickable: boolean;
  overlay: ToolOnMap<I> | null;
  search: ToolOnMap<I> | null;
  pinned: boolean;
}

/** Draw `item`'s popup, or hide it for null; `say` is the text's popupText. */
export function updateSidebar<I extends MapItem>(
  elements: SidebarElements,
  item: I | null,
  say: (item: I) => PopupText,
  view: PopupView<I>,
): void {
  const { sidebar, ref, overlayInfo, hebrew, notice, english, link } = elements;
  const { textsNotice, search, pinned: isPinned } = view;
  // Words are clickable only while something listens for them.
  const heard = view.wordsClickable ? wordClickHandler : null;
  const currentOverlay = view.overlay?.tool ?? null;
  const overlaySettings = view.overlay?.settings;
  const overlayData = view.overlay?.data;

  if (!sidebar) return;

  if (!item) {
    sidebar.classList.remove('visible');
    sidebar.classList.remove('pinned');
    return;
  }

  const verse = item;
  const said = say(item);
  const text = said.hebrew || said.english ? { he: said.hebrew, en: said.english } : null;

  if (ref) {
    ref.textContent = said.ref;
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
      if (heard) {
        // Whatever the overlay produced, words are wrapped afterwards, so a click
        // finds a word whether or not anything is highlighting the text.
        container.replaceChildren(wrapWordsInFragment(fragment, text.he));
        attachWordClicks(container, text.he, verse, heard);
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
  if (link) link.href = said.link;

  sidebar.classList.add('visible');
  if (isPinned) {
    sidebar.classList.add('pinned');
  } else {
    sidebar.classList.remove('pinned');
  }
}
