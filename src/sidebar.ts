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
 * Build Sefaria URL for a verse with context-aware parameters
 *
 * When viewing the commentary overlay with a specific category filter,
 * opens Sefaria to that category (e.g., ?with=Talmud).
 * Otherwise, opens to all connections (?with=all) since we show link counts.
 */
export function getSefariaUrl(
  book: string,
  chapter: number,
  verse: number,
  currentOverlay: Overlay | null = null,
): string {
  const sefariaBook = book.replace(/ /g, '_');
  const baseUrl = `https://www.sefaria.org/${sefariaBook}.${chapter}.${verse}`;

  if (currentOverlay?.id === 'commentary') {
    const urlParams = currentOverlay.getUrlParams?.();
    const category = urlParams?.category;
    if (category) {
      return `${baseUrl}?with=${encodeURIComponent(category)}`;
    }
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
  if (overlayInfo) {
    const sidebarInfo = currentOverlay?.renderSidebarInfo?.(verse, isPinned);
    if (sidebarInfo) {
      if (typeof sidebarInfo === 'string') {
        overlayInfo.innerHTML = sidebarInfo;
      } else {
        overlayInfo.replaceChildren(sidebarInfo);
      }
    } else {
      const hoverInfo = currentOverlay?.getHoverInfo?.(verse);
      overlayInfo.textContent = hoverInfo || '';
    }
  }
  if (hebrew) {
    const hebrewText = text?.he || 'Loading...';
    const highlighted = currentOverlay?.highlightVerseText?.(hebrewText, 'he');

    // Whatever the overlay produced, words are wrapped afterwards, so a click
    // finds a word whether or not anything is highlighting the text.
    const fragment = document.createDocumentFragment();
    if (highlighted && highlighted !== hebrewText) {
      if (typeof highlighted === 'string') {
        const holder = document.createElement('div');
        holder.innerHTML = highlighted;
        fragment.append(...holder.childNodes);
      } else {
        fragment.appendChild(highlighted);
      }
    } else {
      fragment.appendChild(document.createTextNode(hebrewText));
    }

    hebrew.replaceChildren(wrapWordsInFragment(fragment, hebrewText));
    attachWordClicks(hebrew as HTMLElement, hebrewText, verse);
  }
  if (english) {
    const englishText = text?.en || 'Loading...';
    const highlighted = currentOverlay?.highlightVerseText?.(englishText, 'en');
    if (highlighted && highlighted !== englishText) {
      if (typeof highlighted === 'string') {
        english.innerHTML = highlighted;
      } else {
        english.replaceChildren(highlighted);
      }
    } else {
      english.textContent = englishText;
    }
  }
  if (link) {
    link.href = getSefariaUrl(verse.book, verse.chapter, verse.verse, currentOverlay);
  }
  if (linkSubtitle) {
    const overlaySubtitle = currentOverlay?.getLinkSubtitle?.(verse);
    if (overlaySubtitle) {
      linkSubtitle.textContent = overlaySubtitle;
    } else {
      const linkCount = getVerseLinkCount(verse.book, verse.chapter, verse.verse);
      linkSubtitle.textContent = linkCount ? `${linkCount} linked texts` : '';
    }
  }

  sidebar.classList.add('visible');
  if (isPinned) {
    sidebar.classList.add('pinned');
  } else {
    sidebar.classList.remove('pinned');
  }
}
