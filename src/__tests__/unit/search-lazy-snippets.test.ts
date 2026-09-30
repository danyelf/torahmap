// A result row's snippet is worked out when the row is drawn, from the verse
// and the term.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  buildSearchIndex,
  computeSnippetForMatch,
  loadLexiconData,
  type SearchResult,
} from '../../search';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import type { VerseTexts } from '../../verseTexts';

beforeAll(async () => {
  await loadLexiconData();
});

describe('computeSnippetForMatch', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with Hebrew content
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם',
            en: 'In the beginning God created the heavens',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם',
            en: 'And the earth was without form and void, and the spirit of God moved upon the waters',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'And God said let there be light',
          },
        },
        '2': {
          '7': {
            he: 'וַיִּיצֶר יְהוָה אֱלֹהִים אֶת־הָאָדָם',
            en: 'And the LORD God formed man',
          },
        },
        '12': {
          '1': {
            he: 'וַיֹּאמֶר יְהוָה אֶל־אַבְרָם',
            en: 'And the LORD said to Abram',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  const genesis11: SearchResult = {
    book: 'Genesis',
    chapter: 1,
    verse: 1,
    language: 'he',
    matchingTerms: [{ termIndex: 0 }],
  };

  it('quotes the verse with the word marked', () => {
    const snippet = computeSnippetForMatch(genesis11, 'אלהים')!;

    expect(snippet.matchEnd).toBeGreaterThan(snippet.matchStart);
    expect(snippet.matchEnd).toBeLessThanOrEqual(snippet.snippet.length);
    expect(snippet.snippet.slice(snippet.matchStart, snippet.matchEnd)).toMatch(/א.*ל.*ה.*י.*ם/);
  });

  it('marks the word in every verse a meanings-mode search finds', () => {
    const results = searchInMeaningsMode('אלהים');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const snippet = computeSnippetForMatch(result, 'אלהים')!;
      expect(snippet.matchEnd).toBeGreaterThan(snippet.matchStart);
    }
  });

  it('returns null for a verse not in the index', () => {
    const missing: SearchResult = { ...genesis11, book: 'NonExistent', chapter: 999, verse: 999 };
    expect(computeSnippetForMatch(missing, 'אלהים')).toBeNull();
  });

  it('quotes the verse unmarked when the word is not in it', () => {
    // A Hebrew word the verse does not contain. It has to be Hebrew: the
    // term's own script decides which text is quoted, so a Latin word here
    // would ask for the English verse and rightly get it.
    const snippet = computeSnippetForMatch(genesis11, '\u05E1\u05D5\u05E1')!;

    expect(snippet.matchStart).toBe(0);
    expect(snippet.matchEnd).toBe(0);
    expect(snippet.snippet).toMatch(/[\u0590-\u05FF]/);
  });
});
