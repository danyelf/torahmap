// Turning a clicked word into a search term.
//
// Clicking adds to the search rather than replacing it: the map is for
// comparing, and two words in two colours is the comparison.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, searchForMeaning, type SearchSettings } from '../../../overlays/search';
import { meaningsInVerse } from '../../../search/dictionary';
import { loadLexiconData, buildSearchIndex } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';
import { renderSearchControls } from '../../helpers/searchOverlay';
import type { VerseTexts } from '../../../verseTexts';

registerAllOverlays();
const searchOverlay = hostOverlay(getOverlay('search')!);

const texts: VerseTexts = {
  Genesis: {
    3: { 7: { he: 'ויתפרו עלה תאנה', en: 'they sewed fig leaves' } },
    8: { 20: { he: 'ויעל עלת במזבח', en: 'offered burnt offerings' } },
  },
};

const verses = [
  createVerse({ book: 'Genesis', chapter: 3, verse: 7 }),
  createVerse({ book: 'Genesis', chapter: 8, verse: 20 }),
];

function render(): HTMLDivElement {
  return renderSearchControls(searchOverlay);
}

/**
 * Choose a word from a verse, as main.ts does: the search it asks for becomes
 * the search held. False when the palette is full and nothing changed.
 */
function clickWord(text: string, meaningKeys: readonly string[] | null): boolean {
  const next = searchForMeaning(searchOverlay.settings as SearchSettings, text, meaningKeys);
  if (next) searchOverlay.change(next);
  return next !== null;
}

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(texts);
});

beforeEach(() => {
  configure({ verses });
  searchOverlay.restore({ q: '', mode: undefined, m: undefined });
});

describe('searching for a clicked word', () => {
  it('creates a term narrowed to the chosen meaning', () => {
    const container = render();
    const leaf = meaningsInVerse('עלה', 'Genesis:3:7')[0];

    expect(clickWord('עלה', leaf.keys)).toBe(true);

    const rows = [...container.querySelectorAll('.term-row')];
    expect(rows).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('.term-input')!.value).toBe('עלה');

    const params = searchOverlay.toUrl();
    expect(params.q).toBe('עלה');
    expect(params.m).toContain(leaf.keys[0]);
  });

  it('adds a second word rather than replacing the first', () => {
    const container = render();
    clickWord('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys);
    clickWord('רוח', null);

    expect(container.querySelectorAll('.term-row')).toHaveLength(2);
  });

  it('switches Hebrew mode to meanings, since a meaning cannot be matched as a substring', () => {
    render();
    searchOverlay.restore({ q: '', mode: 's', m: undefined });

    clickWord('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys);

    // The click chose meanings for this word, and a choice is written even when it
    // matches the default — the reader made it, so the link carries it.
    expect(searchOverlay.toUrl().mode).toBe('m');
  });

  it('leaves the row showing the mode the click put it in', () => {
    const container = render();
    searchOverlay.restore({ q: '', mode: 's', m: undefined });

    clickWord('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys);

    const marked = container.querySelector<HTMLElement>(
      '.term-row[data-open="true"] .term-mode-option.on',
    );
    expect(marked?.dataset.mode).toBe('meanings');
  });

  it('keeps the results list on screen after the click that filled it', () => {
    // The choice is made in a panel on document.body, so the click carries on
    // bubbling to document after the search has run. Anything listening there
    // for "a click outside the controls" sees this one and puts the list away
    // the instant it was filled.
    const container = render();
    document.body.appendChild(container);

    clickWord('עלה', meaningsInVerse('עלה', 'Genesis:3:7')[0].keys);
    const results = container.querySelector('#search-results')!;
    expect(results.classList.contains('visible')).toBe(true);

    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);
    elsewhere.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(results.classList.contains('visible')).toBe(true);
    container.remove();
    elsewhere.remove();
  });

  it('searches the written form itself when no meaning is chosen', () => {
    const container = render();

    expect(clickWord('לו', null)).toBe(true);
    expect(container.querySelector<HTMLInputElement>('.term-input')!.value).toBe('לו');
  });

  it('matches whole words when the written form is what was asked for', () => {
    // The reader asked for this spelling and no other. Left in substring mode
    // it would match inside longer words, and left in meanings mode a known word
    // would be resolved to its dictionary entry - neither is what "exactly"
    // means.
    const container = render();
    searchOverlay.restore({ q: '', mode: 's', m: undefined });

    clickWord('עלה', null);

    expect(searchOverlay.toUrl().mode).toBe('w');
    expect(
      container.querySelector<HTMLElement>('.term-row[data-open="true"] .term-mode-option.on')!
        .dataset.mode,
    ).toBe('word');
  });

  it('refuses a sixth word, because the palette holds five', () => {
    render();
    for (const word of ['עלה', 'רוח', 'מלך', 'בית', 'ארץ']) {
      expect(clickWord(word, null)).toBe(true);
    }

    expect(clickWord('שלום', null)).toBe(false);
  });

  it('fills an empty row that is not last, without disturbing a later term', () => {
    const container = render();

    // Build two terms, then clear the first one so the empty row to fill is
    // no longer the last row. A reader gets here by clearing an earlier box
    // while a later one still holds a word.
    const firstMeaning = meaningsInVerse('עלה', 'Genesis:3:7')[0];
    clickWord('עלה', firstMeaning.keys);
    clickWord('רוח', null);

    // Only the open row holds a box, so reaching the first one means opening
    // it, which is what a reader clearing an earlier word does too.
    expect(container.querySelectorAll('.term-row')).toHaveLength(2);
    const firstRow = container.querySelectorAll<HTMLElement>('.term-row')[0];
    firstRow.querySelector<HTMLElement>('.term-summary')!.click();

    const firstInput = firstRow.querySelector<HTMLInputElement>('.term-input')!;
    firstInput.value = '';
    firstInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Click a different meaning of the same written form. If the code tracks
    // "the last term" instead of the term it actually filled, this narrowing
    // lands on the second term (still holding 'רוח') instead of the first.
    const secondMeaning = meaningsInVerse('עלה', 'Genesis:8:20')[0];
    clickWord('עלה', secondMeaning.keys);

    const shown = [...container.querySelectorAll<HTMLElement>('.term-row')].map(
      (row) =>
        row.querySelector<HTMLInputElement>('.term-input')?.value ??
        row.querySelector('.term-word')!.textContent,
    );
    expect(shown).toEqual(['עלה', 'רוח']);

    const params = searchOverlay.toUrl();
    const [firstEntry, secondEntry] = (params.m ?? '').split(',');
    expect(firstEntry).toBe(secondMeaning.keys[0]);
    // 'רוח' was never clicked with a meaning, so it stays fully unnarrowed.
    expect(secondEntry ?? '').toBe('');
  });

  it('leaves an already narrowed word narrowed', () => {
    // Narrow one word to a meaning, then ask for a second word by its written
    // form. The second click must not move the whole search to whole-word
    // mode: that widens the first word back to all of its readings, leaving
    // its meaning ticked with nothing filtering by it.
    render();
    const leaf = meaningsInVerse('עלה', 'Genesis:3:7')[0];

    clickWord('עלה', leaf.keys);
    const afterFirst = searchOverlay.toUrl();
    expect(afterFirst.mode).toBe('m');

    clickWord('תאנה', null);
    const afterSecond = searchOverlay.toUrl();

    // The first word is still matched by meanings, and still narrowed; only the
    // second word went to whole word.
    expect(afterSecond.mode).toBe('m,w');
    expect((afterSecond.m ?? '').split(',')[0]).toBe(afterFirst.m);
  });
});
