// The meaning filter, as the reader meets it.
//
// A Hebrew word written without vowels is often several different words. עלה is
// five of them. The search has always painted all of them and labelled the
// result with one; these tests are about the control that splits them.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure } from '../../../overlays/search';
import { loadLexiconData, buildSearchIndex } from '../../../search';
import { createVerse } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';
import { renderSearchControls, typeInSearch } from '../../helpers/searchOverlay';
import type { VerseTexts } from '../../../verseTexts';
import { meaningsFor } from '../../../search/dictionary';

registerAllOverlays();
const searchOverlay = hostOverlay(getOverlay('search')!);

// Real Hebrew, so the lexeme index has something to resolve.
const texts: VerseTexts = {
  Genesis: {
    3: { 7: { he: 'ויתפרו עלה תאנה', en: 'they sewed fig leaves' } },
    8: { 20: { he: 'ויעל עלת במזבח', en: 'offered burnt offerings' } },
    35: { 1: { he: 'עלה בית אל', en: 'go up to Bethel' } },
  },
};

const verses = [
  createVerse({ book: 'Genesis', chapter: 3, verse: 7 }),
  createVerse({ book: 'Genesis', chapter: 8, verse: 20 }),
  createVerse({ book: 'Genesis', chapter: 35, verse: 1 }),
];

function render(): HTMLDivElement {
  return renderSearchControls(searchOverlay);
}

function type(container: HTMLElement, text: string): void {
  typeInSearch(container, text);
}

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(texts);
});

beforeEach(() => {
  configure({ verses });
  searchOverlay.restore({ q: '', mode: undefined, m: undefined });
});

describe('the meaning list', () => {
  it('offers every word עלה could be, with a verse count each', () => {
    const container = render();
    type(container, 'עלה');

    // This test owns the DOM shape; search-dictionary.test.ts owns the list.
    const expected = meaningsFor('עלה');
    expect(expected.length).toBeGreaterThan(1);

    const rows = [...container.querySelectorAll('.meaning-row')];
    expect(rows.map((r) => r.querySelector('.meaning-gloss')?.textContent)).toEqual(
      expected.map((m) => m.gloss),
    );
    expect(rows.map((r) => r.querySelector('.meaning-count')?.textContent)).toEqual(
      expected.map((m) => String(m.verseCount)),
    );
  });

  it('starts with every meaning checked, so nothing is hidden by default', () => {
    const container = render();
    type(container, 'עלה');

    const boxes = [...container.querySelectorAll<HTMLInputElement>('.meaning-row input')];
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('marks Aramaic and leaves Hebrew unmarked', () => {
    const container = render();
    type(container, 'עלה');

    const expected = meaningsFor('עלה');
    const tags = [...container.querySelectorAll('.meaning-tag')].map((t) => t.textContent);

    expect(tags).toHaveLength(expected.length);
    expect(expected.some((m) => m.language === 'arc')).toBe(true);
    expect(expected.some((m) => m.language === 'heb')).toBe(true);
    expected.forEach((meaning, i) => {
      expect(tags[i]!.includes('aram.')).toBe(meaning.language === 'arc');
    });
  });

  it('shows no list at all for a word that means only one thing', () => {
    const container = render();
    type(container, 'בראשית');

    expect(container.querySelectorAll('.meaning-row')).toHaveLength(0);
  });

  it('shows no list for an English search', () => {
    const container = render();
    type(container, 'beginning');

    expect(container.querySelectorAll('.meaning-row')).toHaveLength(0);
  });
});

describe('narrowing repaints the map', () => {
  it('drops the leafage verse when leafage is unchecked', () => {
    const container = render();
    type(container, 'עלה');

    const figLeaves = verses[0];
    expect(searchOverlay.getVerseColor(figLeaves)).not.toEqual(dimmed());

    uncheck(container, 'leafage');

    expect(searchOverlay.getVerseColor(figLeaves)).toEqual(dimmed());
  });

  it('keeps the verses of the meanings still checked', () => {
    const container = render();
    type(container, 'עלה');
    uncheck(container, 'leafage');

    expect(searchOverlay.getVerseColor(verses[2])).not.toEqual(dimmed());
  });

  it('will not let the reader uncheck the last one', () => {
    const container = render();
    type(container, 'עלה');
    for (const gloss of ['burnt-offering', 'leafage', 'pretext']) uncheck(container, gloss);

    uncheck(container, 'ascend');

    const boxes = [...container.querySelectorAll<HTMLInputElement>('.meaning-row input')];
    expect(boxes.filter((b) => b.checked)).toHaveLength(1);
  });
});

describe('the URL', () => {
  it('writes back the q, mode and m it was read from', () => {
    const link = { q: 'עלה, רוח, light', mode: 'm,w,', m: '<LH/@heb,,' };
    const settings = searchOverlay.fromUrl(link);

    expect(searchOverlay.overlay.settingsToUrl!(settings)).toEqual(link);
  });

  it('says nothing about meanings until one is unchecked', () => {
    const container = render();
    type(container, 'עלה');

    expect(searchOverlay.toUrl().m).toBeUndefined();
  });

  it('carries the narrowing', () => {
    const container = render();
    type(container, 'עלה');
    const kept = meaningsFor('עלה')
      .filter((m) => m.gloss !== 'ascend')
      .flatMap((m) => m.keys);
    uncheck(container, 'ascend');

    expect(searchOverlay.toUrl().m).toBe(kept.join('|'));
  });

  it('restores it', () => {
    searchOverlay.restore({ q: 'עלה', mode: 'r', m: '<LH/@heb' });
    const container = render();

    const checked = [...container.querySelectorAll<HTMLInputElement>('.meaning-row input')].filter(
      (b) => b.checked,
    );
    expect(checked).toHaveLength(1);
    expect(searchOverlay.getVerseColor(verses[0])).toEqual(dimmed());
  });
});

describe('the Hebrew default', () => {
  it('starts in meanings mode, where the meaning filter lives', () => {
    const container = render();
    type(container, 'עלה');

    const marked = container.querySelector<HTMLElement>(
      '.term-row[data-open="true"] .term-mode-option.on',
    );
    expect(marked?.dataset.mode).toBe('meanings');
  });

  it('says how many meanings a collapsed row is searching for', () => {
    const container = render();
    type(container, 'עלה');
    // Counted rather than written down: rebuilding the index changes it.
    const offered = container.querySelectorAll('.meaning-row').length;

    // Add a second word so the עלה row collapses and has to describe itself.
    container.querySelector<HTMLButtonElement>('#add-term')!.click();

    const state = container
      .querySelectorAll<HTMLElement>('.term-row')[0]
      .querySelector('.term-state')!;
    expect(state.textContent).toBe(`meanings · all ${offered} meanings`);
  });

  it('names the meanings once the row is narrowed', () => {
    const container = render();
    type(container, 'עלה');

    // Keep one meaning, then collapse the row.
    container.querySelectorAll<HTMLButtonElement>('.meaning-only')[2].click();
    container.querySelector<HTMLButtonElement>('#add-term')!.click();

    const state = container
      .querySelectorAll<HTMLElement>('.term-row')[0]
      .querySelector('.term-state')!;
    expect(state.textContent).toBe('meanings · leafage');
  });

  it('leaves the mode bare when there is no choice of meaning to report', () => {
    const container = render();
    // A word the lexeme index does not know has no meanings, so there is
    // nothing to count and no checkboxes either.
    type(container, 'zzqq');
    container.querySelector<HTMLButtonElement>('#add-term')!.click();

    const state = container
      .querySelectorAll<HTMLElement>('.term-row')[0]
      .querySelector('.term-state')!;
    expect(state.textContent).toBe('substring');
  });

  it('hides the meaning list in substring mode, which cannot use it', () => {
    const container = render();
    type(container, 'עלה');

    container
      .querySelector<HTMLElement>(
        '.term-row[data-open="true"] .term-mode-option[data-mode="substring"]',
      )!
      .click();

    expect(container.querySelectorAll('.meaning-row')).toHaveLength(0);
  });
});

function dimmed(): [number, number, number] {
  const b = (0.4 + 0.2) * 0.3;
  return [b, b, b];
}

function uncheck(container: HTMLElement, gloss: string): void {
  const row = [...container.querySelectorAll('.meaning-row')].find(
    (r) => r.querySelector('.meaning-gloss')?.textContent === gloss,
  )!;
  const box = row.querySelector<HTMLInputElement>('input')!;
  box.checked = false;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('showing only one meaning', () => {
  function only(container: HTMLElement, gloss: string): void {
    const row = [...container.querySelectorAll('.meaning-row')].find(
      (r) => r.querySelector('.meaning-gloss')?.textContent === gloss,
    )!;
    row.querySelector<HTMLButtonElement>('.meaning-only')!.click();
  }

  it('leaves that meaning checked and the rest not', () => {
    const container = render();
    type(container, 'עלה');

    only(container, 'burnt-offering');

    const rows = [...container.querySelectorAll('.meaning-row')];
    const checked = rows.filter((r) => r.querySelector<HTMLInputElement>('input')!.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].querySelector('.meaning-gloss')?.textContent).toBe('burnt-offering');
  });

  it('repaints the map, dropping the meanings it left behind', () => {
    const container = render();
    type(container, 'עלה');

    only(container, 'burnt-offering');

    // Genesis 3:7 is the fig-leaf verse, so it goes.
    expect(searchOverlay.getVerseColor(verses[0])).toEqual(dimmed());
  });

  it('offers a way back only once something is narrowed', () => {
    const container = render();
    type(container, 'עלה');
    expect(container.querySelector<HTMLElement>('.term-all')!.hidden).toBe(true);

    only(container, 'burnt-offering');

    expect(container.querySelector<HTMLElement>('.term-all')!.hidden).toBe(false);
  });

  it('puts every meaning back', () => {
    const container = render();
    type(container, 'עלה');
    only(container, 'burnt-offering');

    container.querySelector<HTMLButtonElement>('.term-all')!.click();

    const boxes = [...container.querySelectorAll<HTMLInputElement>('.meaning-row input')];
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(container.querySelector<HTMLElement>('.term-all')!.hidden).toBe(true);
  });

  it('writes the narrowing to the URL and takes it away again', () => {
    const container = render();
    type(container, 'עלה');
    only(container, 'burnt-offering');
    expect(searchOverlay.toUrl().m).toBe('<LH/@heb');

    container.querySelector<HTMLButtonElement>('.term-all')!.click();

    expect(searchOverlay.toUrl().m).toBeUndefined();
  });
});

describe('highlighting a verse when the terms are not all one language', () => {
  it('marks the Hebrew term in the Hebrew text and leaves the English one out', () => {
    const container = render();
    type(container, 'עלה, leaves');

    const marks = [...searchOverlay.highlightVerseText('ויתפרו עלה תאנה', 'he').childNodes]
      .filter((n) => (n as Element).tagName === 'MARK')
      .map((n) => n.textContent);

    expect(marks).toEqual(['עלה']);
  });

  it('marks the English term in the English text and leaves the Hebrew one out', () => {
    const container = render();
    type(container, 'עלה, leaves');

    const marks = [...searchOverlay.highlightVerseText('they sewed fig leaves', 'en').childNodes]
      .filter((n) => (n as Element).tagName === 'MARK')
      .map((n) => n.textContent);

    expect(marks).toEqual(['leaves']);
  });
});

describe('a row that is empty or too short to search', () => {
  it('offers no meanings, rather than every word in the dictionary', () => {
    const container = render();
    type(container, 'עלה');
    container.querySelector<HTMLButtonElement>('#add-term')!.click();

    const rows = [...container.querySelectorAll('.term-row')];
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelectorAll('.meaning-row')).toHaveLength(0);
  });

  it('does not change what the map paints', () => {
    const container = render();
    type(container, 'עלה');
    const before = searchOverlay.getVerseColor(verses[0]);

    container.querySelector<HTMLButtonElement>('#add-term')!.click();

    expect(searchOverlay.getVerseColor(verses[0])).toEqual(before);
  });

  it('does not steal the count from the row below it', () => {
    const container = render();
    type(container, 'עלה, מזבח');

    // Empty the first row. The second keeps its own hits — its count comes
    // from where it sits among the terms being searched, not among the rows.
    const first = container.querySelectorAll<HTMLInputElement>('.term-input')[0];
    first.value = '';
    first.dispatchEvent(new Event('input', { bubbles: true }));

    const counts = [...container.querySelectorAll('.term-count')].map((c) => c.textContent);
    expect(counts[0]).toBe('');
    expect(Number(counts[1])).toBeGreaterThan(0);
  });
});

// The line under a verse's reference names each term as its row does: the word
// as typed, and the meanings it is narrowed to.
describe('the Matches line', () => {
  it('names an unnarrowed word as typed, without listing its meanings', () => {
    const container = render();
    type(container, 'עלה');

    expect(searchOverlay.getHoverInfo(verses[2])).toBe('Matches: עלה');
  });

  it('puts the meaning a word is narrowed to after it', () => {
    const container = render();
    type(container, 'עלה');
    const row = [...container.querySelectorAll('.meaning-row')].find(
      (r) => r.querySelector('.meaning-gloss')?.textContent === 'burnt-offering',
    )!;
    row.querySelector<HTMLButtonElement>('.meaning-only')!.click();

    expect(searchOverlay.getHoverInfo(verses[1])).toBe('Matches: עלה (burnt-offering)');
  });
});
