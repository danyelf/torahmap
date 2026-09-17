// Clicking a word in the verse popup.
//
// The sidebar turns the Hebrew into clickable words and reports which one was
// hit. It does not decide what the click means - that belongs to whatever is
// listening.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSidebarElements, updateSidebar, setWordClickHandler } from '../../sidebar';
import { createVerse } from '../helpers/fixtures';
import type { VerseTexts } from '../../verseTexts';
import type { Overlay } from '../../overlays/types';

const texts: VerseTexts = {
  Genesis: { 1: { 2: { he: 'וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת', en: 'a wind from God sweeping' } } },
};

const getVerseText = (all: VerseTexts, book: string, chapter: number, verse: number) =>
  all[book]?.[chapter]?.[verse] ?? null;

function mountPopup(): void {
  document.body.innerHTML = `
    <div id="verse-popup">
      <div class="verse-ref"><span class="ref-text"></span><button class="close-btn"></button></div>
      <div class="overlay-info"></div>
      <div class="verse-hebrew"></div>
      <div class="verse-english"></div>
      <a class="sefaria-link"><span class="link-subtitle"></span></a>
    </div>`;
}

beforeEach(() => {
  mountPopup();
  setWordClickHandler(null);
});

describe('words in the verse popup', () => {
  it('renders one clickable span per word', () => {
    const elements = getSidebarElements();
    updateSidebar(
      elements,
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      texts,
      null,
      getVerseText,
      true,
    );

    const spans = [...document.querySelectorAll('.verse-hebrew .verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['וְר֣וּחַ', 'אֱלֹהִ֔ים', 'מְרַחֶ֖פֶת']);
  });

  it('reports the word that was clicked, and its verse', () => {
    const handler = vi.fn();
    setWordClickHandler(handler);

    const elements = getSidebarElements();
    updateSidebar(
      elements,
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      texts,
      null,
      getVerseText,
      true,
    );

    document.querySelector<HTMLElement>('[data-word-index="0"]')!.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      text: 'וְר֣וּחַ',
      index: 0,
      book: 'Genesis',
      chapter: 1,
      verse: 2,
    });
  });

  it('leaves the English alone', () => {
    const elements = getSidebarElements();
    updateSidebar(
      elements,
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      texts,
      null,
      getVerseText,
      true,
    );

    expect(document.querySelectorAll('.verse-english .verse-word')).toHaveLength(0);
  });

  it('says nothing when there is no handler', () => {
    const elements = getSidebarElements();
    updateSidebar(
      elements,
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      texts,
      null,
      getVerseText,
      true,
    );

    expect(() =>
      document.querySelector<HTMLElement>('[data-word-index="0"]')!.click(),
    ).not.toThrow();
  });

  it('reports the whole word when a click lands inside an overlay mark', () => {
    // Search wraps a match in <mark>, and trop marks a single accent - either
    // way the mark can land inside a word rather than around the whole thing,
    // same as the interrupted-word case in verseWords-dom.test.ts. The word
    // index is shared across the pieces precisely so a click on either half
    // still resolves to the whole word: that's the case this test covers.
    const handler = vi.fn();
    setWordClickHandler(handler);

    const mockOverlay: Overlay = {
      id: 'test-overlay',
      name: 'Test overlay',
      getVerseColor: () => null,
      highlightVerseText: vi.fn((text: string, language: 'he' | 'en') => {
        const fragment = document.createDocumentFragment();
        if (language !== 'he') {
          fragment.appendChild(document.createTextNode(text));
          return fragment;
        }
        // Mark the first three characters of the first word - interior to
        // the word, not at a word boundary - leaving the rest of the text
        // untouched so it still matches the source exactly.
        const mark = document.createElement('mark');
        mark.textContent = text.slice(0, 3);
        fragment.appendChild(mark);
        fragment.appendChild(document.createTextNode(text.slice(3)));
        return fragment;
      }),
    };

    const elements = getSidebarElements();
    updateSidebar(
      elements,
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      texts,
      mockOverlay,
      getVerseText,
      true,
    );

    const hebrew = document.querySelector('.verse-hebrew')!;
    expect(hebrew.querySelector('mark')).not.toBeNull();

    // Word 0 should be split into (at least) two spans sharing one index.
    const word0Spans = [...hebrew.querySelectorAll('[data-word-index="0"]')];
    expect(word0Spans.length).toBeGreaterThanOrEqual(2);

    const insideMark = hebrew.querySelector<HTMLElement>('mark .verse-word')!;
    expect(insideMark).not.toBeNull();
    insideMark.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      text: 'וְר֣וּחַ',
      index: 0,
      book: 'Genesis',
      chapter: 1,
      verse: 2,
    });
  });
});
