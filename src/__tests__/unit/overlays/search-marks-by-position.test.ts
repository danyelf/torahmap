// Two terms, one spelling, two colours.
//
// Genesis 8:20 holds both words spelled עלה: Noah offers burnt-offerings,
// עֹלֹת, and sends them up, וַיַּעַל. A reader with one term narrowed to the verb
// and another to the nouns should see one colour on each word. The spelling
// cannot tell them apart — it could be either — so the marking has to ask where
// the word sits in the verse.
//
// These go through `highlightVerseText`, the overlay's own entry point, rather
// than through a copy of its loop. A test that reimplements the loop proves the
// helper works and says nothing about whether the overlay calls it, which is
// exactly the gap this closes.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchTool } from '../../../overlays/search/index';
import { configure } from '../../../overlays/search';
import { hostOverlay } from '../../helpers/overlayHost';
import { createVerse } from '../../helpers/fixtures';
import { realSearchData } from '../../helpers/searchData';

const searchOverlay = hostOverlay(searchTool, realSearchData().files);

/** The two readings, as the URL names them: the verb, then the three nouns. */
const ASCEND = '<LH[@heb';
const OFFERINGS = '<LH/@heb|<LH=/@heb|<LH/@arc';

const hebrew = realSearchData().files.texts['Genesis']['8']['20'].he;

beforeEach(() => {
  searchOverlay.restore({ search: '' });
  configure({ verses: [createVerse({ book: 'Genesis', chapter: 8, verse: 20 })] });
});

/** Each mark in the highlighted verse, as [which term, the letters marked]. */
function marks(): Array<[string, string]> {
  const fragment = searchOverlay.highlightVerseText(
    createVerse({ book: 'Genesis', chapter: 8, verse: 20 }),
    hebrew,
    'he',
  );
  const host = document.createElement('div');
  host.appendChild(fragment.cloneNode(true));

  return [...host.querySelectorAll('mark')].map((m) => [
    m.className,
    (m.textContent ?? '').replace(/[^א-ת]/g, ''),
  ]);
}

/** Search for עלה twice over, narrowed to the verb and to the nouns. */
function searchBothReadings(): void {
  searchOverlay.restore({ search: 'עלה, עלה', m: `${ASCEND},${OFFERINGS}` });
}

describe('marking a verse that holds two words of one spelling', () => {
  it('gives each word to the term that means it', () => {
    searchBothReadings();

    // Either term's spelling matches either word, so only the place in the
    // verse decides which is which. Matching on the spelling alone gives both
    // words to whichever term claims a position first.
    expect(marks()).toEqual([
      ['term-0', 'ויעל'],
      ['term-1', 'עלת'],
    ]);
  });

  it('marks the verb alone when only the verb is searched for', () => {
    searchOverlay.restore({ search: 'עלה', m: ASCEND });

    expect(marks()).toEqual([['term-0', 'ויעל']]);
  });

  it('marks the offering alone when only the nouns are searched for', () => {
    searchOverlay.restore({ search: 'עלה', m: OFFERINGS });

    expect(marks()).toEqual([['term-0', 'עלת']]);
  });

  it('still marks both when the term is not narrowed at all', () => {
    // Nothing chosen means every reading, so the spelling is the whole
    // question again and both words belong to the one term.
    searchOverlay.restore({ search: 'עלה' });

    expect(marks().map(([, word]) => word)).toEqual(['ויעל', 'עלת']);
  });
});

describe('marking a verse without the per-word parse', () => {
  afterEach(() => searchOverlay.setData(realSearchData().files));

  it('lets the spelling decide, so the verb also claims the offering', () => {
    searchOverlay.setData({ ...realSearchData().files, parse: null });
    searchOverlay.restore({ search: 'עלה', m: ASCEND });

    expect(marks()).toEqual([
      ['term-0', 'ויעל'],
      ['term-0', 'עלת'],
    ]);
  });
});
