// Sidebar management for verse details display

import type { VerseLayout } from './types.ts';
import type { Overlay } from './overlays/types.ts';
import type { VerseTexts, VerseText } from './verseTexts.ts';
import { getSelectedTrop, highlightTropInText } from './overlays/trop.ts';
import { highlightSearchTerms } from './overlays/search.ts';
import { getVerseLinkCount, getCurrentCategory, getVerseCategoryCount } from './overlays/commentary.ts';

/**
 * DOM elements that make up the verse details sidebar
 */
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

/**
 * Get references to all sidebar DOM elements
 */
export function getSidebarElements(): SidebarElements {
  const sidebar = document.getElementById('verse-sidebar');

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
 * Build Sefaria URL for a verse
 */
export function getSefariaUrl(book: string, chapter: number, verse: number): string {
  const sefariaBook = book.replace(/ /g, '_');
  return `https://www.sefaria.org/${sefariaBook}.${chapter}.${verse}`;
}

/**
 * Position sidebar below controls panel
 */
export function positionSidebar(
  sidebar: HTMLElement | null,
  controlsPanel: HTMLElement | null
): void {
  if (!sidebar || !controlsPanel) return;
  const controlsRect = controlsPanel.getBoundingClientRect();
  sidebar.style.top = `${controlsRect.bottom + 10}px`;
}

/**
 * Update sidebar with verse info
 */
export function updateSidebar(
  elements: SidebarElements,
  verse: VerseLayout | null,
  verseTexts: VerseTexts,
  currentOverlay: Overlay | null,
  getVerseText: (
    texts: VerseTexts,
    book: string,
    chapter: number,
    verse: number
  ) => VerseText | null,
  isPinned: boolean = false
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
    // Get overlay-specific hover info (e.g., parshah name for Torah verses)
    const hoverInfo = currentOverlay?.getHoverInfo?.(verse);
    overlayInfo.textContent = hoverInfo || '';
  }
  if (hebrew) {
    const hebrewText = text?.he || 'Loading...';
    const selectedTrop = getSelectedTrop();
    if (currentOverlay?.id === 'trop' && selectedTrop) {
      hebrew.innerHTML = highlightTropInText(hebrewText, selectedTrop.unicode);
    } else if (currentOverlay?.id === 'search') {
      hebrew.replaceChildren(highlightSearchTerms(hebrewText, 'he'));
    } else {
      hebrew.textContent = hebrewText;
    }
  }
  if (english) {
    const englishText = text?.en || 'Loading...';
    if (currentOverlay?.id === 'search') {
      english.replaceChildren(highlightSearchTerms(englishText, 'en'));
    } else {
      english.textContent = englishText;
    }
  }
  if (link) {
    link.href = getSefariaUrl(verse.book, verse.chapter, verse.verse);
  }
  if (linkSubtitle) {
    // Show category-specific text when commentary overlay is active
    if (currentOverlay?.id === 'commentary') {
      const category = getCurrentCategory();
      const count = getVerseCategoryCount(verse.book, verse.chapter, verse.verse);
      if (count) {
        const categoryName = category === 'total' ? 'linked texts' : `${category} links`;
        linkSubtitle.textContent = `${count} ${categoryName}`;
      } else {
        linkSubtitle.textContent = '';
      }
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
