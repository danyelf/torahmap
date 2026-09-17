// Sidebar management for verse details display

import type { TanakhLayout } from './types.ts';
import type { Overlay } from './overlays/types.ts';
import type { VerseTexts, VerseText } from './verseTexts.ts';
import { getVerseLinkCount } from './overlays/commentary.ts';
import { splitVerseText, wrapWordsInFragment } from './verseWords.ts';

/** A click on a word in the verse popup's Hebrew text. */
export interface WordClick {
  /** The word exactly as displayed, points and all. */
  text: string;
  /** Its position among the verse's words. */
  index: number;
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
  const words = splitVerseText(text).filter((piece) => piece.kind === 'word');

  container.onclick = (event) => {
    if (!wordClickHandler) return;

    const span = (event.target as HTMLElement)?.closest?.('.verse-word');
    if (!(span instanceof HTMLElement)) return;

    const index = Number(span.dataset.wordIndex);
    const word = words[index];
    if (!word) return;

    wordClickHandler({
      text: word.text,
      index,
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
  english: Element | null;
  link: HTMLAnchorElement | null;
  linkSubtitle: Element | null;
  closeBtn: Element | null;
}

export function getSidebarElements(): SidebarElements {
  const sidebar = document.getElementById('verse-popup');

  return {
    sidebar,
    ref: sidebar?.querySelector('.ref-text') ?? null,
    overlayInfo: sidebar?.querySelector('.overlay-info') ?? null,
    hebrew: sidebar?.querySelector('.verse-hebrew') ?? null,
    english: sidebar?.querySelector('.verse-english') ?? null,
    link: (sidebar?.querySelector('.sefaria-link') as HTMLAnchorElement) ?? null,
    linkSubtitle: sidebar?.querySelector('.link-subtitle') ?? null,
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
  currentOverlay: Overlay | null = null,
): string {
  const sefariaBook = book.replace(/ /g, '_');
  const baseUrl = `https://www.sefaria.org/${sefariaBook}.${chapter}.${verse}`;

  const param = currentOverlay?.getSefariaConnectionParam?.();
  if (param) {
    return `${baseUrl}?with=${encodeURIComponent(param)}`;
  }

  return `${baseUrl}?with=all`;
}

export function updateSidebar(
  elements: SidebarElements,
  verse: TanakhLayout | null,
  verseTexts: VerseTexts,
  currentOverlay: Overlay | null,
  getVerseText: (
    texts: VerseTexts,
    book: string,
    chapter: number,
    verse: number,
  ) => VerseText | null,
  isPinned: boolean = false,
): void {
  const { sidebar, ref, overlayInfo, hebrew, english, link, linkSubtitle } = elements;

  if (!sidebar) return;

  if (!verse) {
    sidebar.classList.remove('visible');
    sidebar.classList.remove('pinned');
    return;
  }

  const text = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);

  if (ref) {
    ref.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
  }
  // Whether the overlay has already spoken about this verse, which decides
  // below whether the Sefaria link repeats a number or stays a plain invitation.
  let overlayHasSpoken = false;
  if (overlayInfo) {
    const sidebarInfo = currentOverlay?.renderSidebarInfo?.(verse, isPinned);
    if (sidebarInfo) {
      overlayInfo.replaceChildren(sidebarInfo);
      overlayHasSpoken = true;
    } else {
      const hoverInfo = currentOverlay?.getHoverInfo?.(verse);
      overlayInfo.textContent = hoverInfo || '';
      overlayHasSpoken = Boolean(hoverInfo);
    }
  }
  if (hebrew) {
    const hebrewText = text?.he || 'Loading...';
    // Whatever the overlay produced, words are wrapped afterwards, so a click
    // finds a word whether or not anything is highlighting the text.
    const fragment =
      currentOverlay?.highlightVerseText?.(hebrewText, 'he') ?? textFragment(hebrewText);

    hebrew.replaceChildren(wrapWordsInFragment(fragment, hebrewText));
    attachWordClicks(hebrew as HTMLElement, hebrewText, verse);
  }
  if (english) {
    const englishText = text?.en || 'Loading...';
    const highlighted = currentOverlay?.highlightVerseText?.(englishText, 'en');
    if (highlighted) {
      english.replaceChildren(highlighted);
    } else {
      english.textContent = englishText;
    }
  }
  if (link) {
    link.href = getSefariaUrl(verse.book, verse.chapter, verse.verse, currentOverlay);
  }
  if (linkSubtitle) {
    // The popup gives a verse's numbers once. The commentary count belongs here
    // only when nothing above is already describing the verse - under the
    // commentary overlay it would otherwise be the same figure twice.
    const linkCount = overlayHasSpoken
      ? null
      : getVerseLinkCount(verse.book, verse.chapter, verse.verse);
    linkSubtitle.textContent = linkCount ? `${linkCount} linked texts` : '';
  }

  sidebar.classList.add('visible');
  if (isPinned) {
    sidebar.classList.add('pinned');
  } else {
    sidebar.classList.remove('pinned');
  }
}
