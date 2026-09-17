// Highlighting a word that carries a combining grapheme joiner.
//
// Sefaria writes Jerusalem with U+034F inside it, between the lamed and the
// final mem. It renders as nothing and a reader never types it. Verse matching
// already folds it away, so the verses are found; the marking inside a verse
// used a different fold that kept it, so nothing was marked.
//
// Both halves of that fold have to agree. Stripping the joiner from the text
// without also counting it when mapping a position back shifts every mark after
// it by one, which looks plausible and is wrong — so these tests assert the
// marked text itself, not merely that a mark exists.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure, highlightSearchTerms } from '../../../overlays/search';
import { applyOverlayParams } from '../../helpers/overlayUrlParams';
import { createVerse } from '../../helpers/fixtures';
import { buildSearchIndex } from '../../../search';
import type { VerseTexts } from '../../../verseTexts';

registerAllOverlays();
const searchOverlay = getOverlay('search')!;

const JOINER = '͏';

// II Kings 21:13, which names Jerusalem twice, each time with a joiner. The
// second is what catches a mapping that has drifted.
const II_KINGS_21_13 =
  'וְנָטִ֣יתִי עַל־יְרוּשָׁלַ֗͏ִם אֵ֚ת קָ֣ו שֹׁמְר֔וֹן וְאֶת־מִשְׁקֹ֖לֶת בֵּ֣ית ' +
  'אַחְאָ֑ב וּמָחִ֨יתִי אֶת־יְרוּשָׁלַ֜͏ִם כַּאֲשֶׁר־יִמְחֶ֤ה אֶת־הַצַּלַּ֙חַת֙ ' +
  'מָחָ֔ה וְהָפַ֖ךְ עַל־פָּנֶֽיהָ׃';

/** The consonants of a marked run, so an assertion can name a word plainly. */
function consonants(text: string): string {
  return text.replace(/[^א-ת]/g, '');
}

function marks(html: string): string[] {
  return [...html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1]);
}

function fragmentToHtml(fragment: DocumentFragment): string {
  const div = document.createElement('div');
  div.appendChild(fragment.cloneNode(true));
  return div.innerHTML;
}

function searchFor(term: string): void {
  const container = document.createElement('div');
  searchOverlay.renderControls?.(container);
  const input = container.querySelector('#search-input') as HTMLInputElement;
  input.value = term;
  input.dispatchEvent(new Event('input'));
}

// Exodus 20:4, where the joiner is nothing to do with Jerusalem. The Decalogue
// is printed with doubled cantillation, and a joiner separates the stacked
// marks — 14 words in all, against Jerusalem's 638. This verse says מתחת twice,
// once carrying a joiner and once not, so one search covers both.
const EXODUS_20_4 =
  'לֹֽ֣א־תַעֲשֶֽׂ֨ה־לְךָ֥֣ פֶ֣֙סֶל֙ ׀ וְכׇל־תְּמוּנָ֔֡ה אֲשֶׁ֤֣ר בַּשָּׁמַ֣֙יִם֙ ׀ מִמַּ֔֡עַל ' +
  'וַֽאֲשֶׁ֥ר֩ בָּאָ֖֨רֶץ מִתָּ֑͏ַ֜חַת וַאֲשֶׁ֥ר בַּמַּ֖֣יִם ׀ מִתַּ֥֣חַת לָאָֽ֗רֶץ׃';

const texts: VerseTexts = {
  'II Kings': { '21': { '13': { he: II_KINGS_21_13, en: 'And I will stretch over Jerusalem' } } },
  Exodus: { '20': { '4': { he: EXODUS_20_4, en: 'You shall not make for yourself an idol' } } },
};

beforeEach(() => {
  vi.clearAllMocks();
  applyOverlayParams(searchOverlay, { q: '' });
  buildSearchIndex(texts);
  configure({
    verses: [
      createVerse({ book: 'II Kings', chapter: 21, verse: 13 }),
      createVerse({ book: 'Genesis', chapter: 35, verse: 22 }),
    ],
  });
});

describe('a word carrying a grapheme joiner', () => {
  it('is present in the verse under test', () => {
    // Guards the fixture: if Sefaria ever drops the joiner, these tests would
    // pass for the wrong reason.
    expect(II_KINGS_21_13).toContain(JOINER);
  });

  it('is marked when it is searched for', () => {
    searchFor('ירושלם');

    const found = marks(fragmentToHtml(highlightSearchTerms(II_KINGS_21_13, 'he')));

    expect(found.length).toBeGreaterThan(0);
  });

  it('marks both occurrences, each on the word itself', () => {
    searchFor('ירושלם');

    const found = marks(fragmentToHtml(highlightSearchTerms(II_KINGS_21_13, 'he')));

    expect(found).toHaveLength(2);
    // Not "contains a mark" but "the mark covers Jerusalem and nothing else".
    // A mapping that ignores the joiner puts the second one a character early,
    // swallowing the space and dropping the final mem.
    expect(found.map(consonants)).toEqual(['ירושלם', 'ירושלם']);
  });

  it('keeps the joiner in the marked text, which is what the reader sees', () => {
    searchFor('ירושלם');

    const found = marks(fragmentToHtml(highlightSearchTerms(II_KINGS_21_13, 'he')));

    // The fold is for matching only. Display keeps the text exactly as it came.
    // Asserted on a non-empty list, because "every" is true of no marks at all.
    expect(found).toHaveLength(2);
    expect(found.every((m) => m.includes(JOINER))).toBe(true);
  });

  it('is not only Jerusalem: the Decalogue carries them too', () => {
    // 652 words carry a joiner. 638 are Jerusalem; the other 14 are eight words
    // in Exodus 20, Deuteronomy 5 and Genesis 35:22, where the doubled
    // cantillation stacks two marks and a joiner separates them.
    searchFor('מתחת');

    const found = marks(fragmentToHtml(highlightSearchTerms(EXODUS_20_4, 'he')));

    // The verse says the word twice, the first carrying a joiner. Before the
    // fix only the second was marked, so the two are not interchangeable here.
    expect(found.map(consonants)).toEqual(['מתחת', 'מתחת']);
    expect(found.filter((m) => m.includes(JOINER))).toHaveLength(1);
  });

  it('still marks a word that follows the joiner at the right place', () => {
    // מחה sits after both Jerusalems, so its position is the sum of every
    // joiner before it. This is the assertion that a drifted mapping fails.
    searchFor('מחה');

    const found = marks(fragmentToHtml(highlightSearchTerms(II_KINGS_21_13, 'he')));

    expect(found.map(consonants)).toContain('מחה');
  });
});
