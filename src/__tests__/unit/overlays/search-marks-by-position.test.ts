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

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure } from '../../../overlays/search';
import { loadLexiconData, buildSearchIndex } from '../../../search';
import { setVerseOnScreen } from '../../../search/dictionary';
import { hostOverlay } from '../../helpers/overlayHost';
import { createVerse } from '../../helpers/fixtures';
import type { VerseTexts } from '../../../verseTexts';

registerAllOverlays();
const searchOverlay = hostOverlay(getOverlay('search')!);

const VERSE = 'Genesis:8:20';
/** The two readings, as the URL names them: the verb, then the three nouns. */
const ASCEND = '<LH[@heb';
const OFFERINGS = '<LH/@heb|<LH=/@heb|<LH/@arc';

let texts: VerseTexts;
let hebrew: string;

beforeAll(async () => {
  texts = await (await fetch('/data/all-texts.json')).json();
  hebrew = texts['Genesis']['8']['20'].he;
  await loadLexiconData();
  buildSearchIndex(texts);
});

beforeEach(async () => {
  searchOverlay.restore({ q: '' });
  configure({ verses: [createVerse({ book: 'Genesis', chapter: 8, verse: 20 })] });

  // Twice, because that is what the app does. The first call names the verse
  // and starts the parse downloading, so it can only work out the words once
  // the file is here; the sidebar draws the verse again when the promise
  // resolves, and that second call is the one that names them.
  await setVerseOnScreen(VERSE, hebrew);
  setVerseOnScreen(VERSE, hebrew);
});

/** Each mark in the highlighted verse, as [which term, the letters marked]. */
function marks(): Array<[string, string]> {
  const fragment = searchOverlay.highlightVerseText(hebrew, 'he');
  const host = document.createElement('div');
  host.appendChild(fragment.cloneNode(true));

  return [...host.querySelectorAll('mark')].map((m) => [
    m.className,
    (m.textContent ?? '').replace(/[^א-ת]/g, ''),
  ]);
}

/** Search for עלה twice over, narrowed to the verb and to the nouns. */
function searchBothReadings(): void {
  searchOverlay.restore({ q: 'עלה, עלה', m: `${ASCEND},${OFFERINGS}` });
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
    searchOverlay.restore({ q: 'עלה', m: ASCEND });

    expect(marks()).toEqual([['term-0', 'ויעל']]);
  });

  it('marks the offering alone when only the nouns are searched for', () => {
    searchOverlay.restore({ q: 'עלה', m: OFFERINGS });

    expect(marks()).toEqual([['term-0', 'עלת']]);
  });

  it('still marks both when the term is not narrowed at all', () => {
    // Nothing chosen means every reading, so the spelling is the whole
    // question again and both words belong to the one term.
    searchOverlay.restore({ q: 'עלה' });

    expect(marks().map(([, word]) => word)).toEqual(['ויעל', 'עלת']);
  });
});
