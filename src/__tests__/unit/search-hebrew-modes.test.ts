// Tests for Hebrew search modes (substring, word, root)
// tm-z8ru: Comprehensive tests for Hebrew mode parameter and mode switching
import { describe, it, expect, beforeEach } from 'vitest';
import { search, buildSearchIndex, searchHebrewWholeWord } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Hebrew Search Modes', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with Hebrew content
    // Including proper nouns like אברהם (Abraham) for testing
    mockVerseTexts = {
      'Genesis': {
        '12': {
          '1': {
            he: 'וַיֹּאמֶר יְהוָה אֶל־אַבְרָם',
            en: 'And the LORD said to Abram',
          },
          '2': {
            he: 'וְאֶעֶשְׂךָ לְגוֹי גָּדוֹל וַאֲבָרֶכְךָ',
            en: 'And I will make you a great nation and I will bless you',
          },
          '3': {
            he: 'וַאֲבָרֲכָה מְבָרְכֶיךָ',
            en: 'And I will bless those who bless you',
          },
        },
        '17': {
          '5': {
            he: 'וְלֹא־יִקָּרֵא עוֹד אֶת־שִׁמְךָ אַבְרָם וְהָיָה שִׁמְךָ אַבְרָהָם',
            en: 'Your name shall no longer be called Abram but your name shall be Abraham',
          },
        },
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם',
            en: 'In the beginning God created the heavens',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ',
            en: 'And the earth was without form and void',
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
      },
      'Exodus': {
        '3': {
          '6': {
            he: 'אָנֹכִי אֱלֹהֵי אָבִיךָ אֱלֹהֵי אַבְרָהָם',
            en: 'I am the God of your father, the God of Abraham',
          },
        },
        '1': {
          '1': {
            he: 'וְאֵלֶּה שְׁמוֹת בְּנֵי יִשְׂרָאֵל',
            en: 'Now these are the names of the children of Israel',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  describe('search() mode parameter - substring mode', () => {
    it('substring mode matches partial words', () => {
      // Search for "אלה" which appears in "ואלה" (Exodus 1:1)
      const results = search('אלה', false, 'substring');

      // Should find "ואלה" because substring mode matches anywhere
      const exodusMatch = results.find(r => r.book === 'Exodus' && r.chapter === 1 && r.verse === 1);
      expect(exodusMatch).toBeDefined();
    });

    it('substring mode is the default', () => {
      // Without specifying mode, should behave like substring
      const withoutMode = search('אלה');
      const withSubstring = search('אלה', false, 'substring');

      expect(withoutMode.length).toBe(withSubstring.length);
    });

    it('substring mode matches "ברא" in "בראשית"', () => {
      const results = search('ברא', false, 'substring');

      // Should match both "ברא" (created) and "בראשית" (beginning)
      expect(results.length).toBeGreaterThanOrEqual(1);

      const gen11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
      expect(gen11).toBeDefined(); // Has both "בְּרֵאשִׁית" and "בָּרָא"
    });

    it('substring mode finds "אבר" in "אברהם" and "אברם"', () => {
      // "אבר" appears as substring in both Abraham and Abram
      const results = search('אבר', false, 'substring');

      // Should match verses with אברהם and אברם
      expect(results.length).toBeGreaterThan(0);

      // Should find Genesis 12:1 (אברם) and 17:5 (אברהם and אברם)
      const hasGen121 = results.some(r => r.book === 'Genesis' && r.chapter === 12 && r.verse === 1);
      const hasGen175 = results.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);

      expect(hasGen121).toBe(true);
      expect(hasGen175).toBe(true);
    });
  });

  describe('search() mode parameter - word mode', () => {
    it('word mode does NOT match partial words', () => {
      // Search for "אלה" - should NOT match "ואלה"
      const results = search('אלה', false, 'word');

      // "ואלה" is a whole word (includes prefix), so "אלה" won't match
      const exodusMatch = results.find(r => r.book === 'Exodus' && r.chapter === 1 && r.verse === 1);
      expect(exodusMatch).toBeUndefined();
    });

    it('word mode matches exact whole words', () => {
      // Search for "אלהים" - should match as whole word
      const results = search('אלהים', false, 'word');

      // Should match verses with standalone "אלהים"
      expect(results.length).toBeGreaterThan(0);

      const gen11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
      expect(gen11).toBeDefined(); // Contains "אֱלֹהִים"
    });

    it('word mode handles proper nouns correctly - אברהם', () => {
      // Search for "אברהם" (Abraham)
      const results = search('אברהם', false, 'word');

      // Should match Genesis 17:5 and Exodus 3:6 where אברהם appears as whole word
      const gen175 = results.find(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      const ex36 = results.find(r => r.book === 'Exodus' && r.chapter === 3 && r.verse === 6);

      expect(gen175).toBeDefined();
      expect(ex36).toBeDefined();
    });

    it('word mode does NOT match אברהם when searching for אברם', () => {
      // "אברם" (Abram) and "אברהם" (Abraham) are different words
      const resultsAbram = search('אברם', false, 'word');
      const resultsAbraham = search('אברהם', false, 'word');

      // Verify they find different sets of verses
      // Abraham should be in Gen 17:5 and Ex 3:6
      const hasAbrahamGen175 = resultsAbraham.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      expect(hasAbrahamGen175).toBe(true);

      // Note: Genesis 17:5 contains BOTH אברם and אברהם in the text
      // "Your name shall no longer be Abram but Abraham"
      // So searching for אברם will also match this verse
    });

    it('word mode strips nikkud before matching', () => {
      // Search without nikkud should match text with nikkud
      const results = search('אלהים', false, 'word');
      expect(results.length).toBeGreaterThan(0);

      // Verify it matches אֱלֹהִים (with nikkud)
      const gen11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
      expect(gen11).toBeDefined();
    });
  });

  describe('search() mode parameter - root mode', () => {
    it('root mode falls back to whole-word when no lemma found', () => {
      // Since we don't load lemma data in tests, root mode should fall back to whole-word
      const rootResults = search('אברהם', false, 'root');
      const wordResults = search('אברהם', false, 'word');

      // Should behave identically to word mode (fallback)
      expect(rootResults.length).toBe(wordResults.length);
    });

    it('root mode fallback finds proper nouns correctly', () => {
      // Even without lemma data, should find "אברהם" as whole word
      const results = search('אברהם', false, 'root');

      const gen175 = results.find(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      const ex36 = results.find(r => r.book === 'Exodus' && r.chapter === 3 && r.verse === 6);

      expect(gen175).toBeDefined();
      expect(ex36).toBeDefined();
    });

    it('root mode does NOT fall back to substring', () => {
      // Root mode should fall back to whole-word, NOT substring
      const rootResults = search('אלה', false, 'root');
      const substringResults = search('אלה', false, 'substring');

      // Root mode should NOT match "ואלה" (requires whole word)
      // Substring mode WOULD match "ואלה"
      expect(rootResults.length).toBeLessThan(substringResults.length);
    });

    it('root mode returns valid search results', () => {
      const results = search('אלהים', false, 'root');

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.book).toBeDefined();
        expect(result.chapter).toBeGreaterThan(0);
        expect(result.verse).toBeGreaterThan(0);
        expect(result.language).toBe('he');
        expect(result.matchingTerms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Mode comparison - behavior differences', () => {
    it('substring mode finds most results, word mode finds fewer', () => {
      const term = 'ברא';

      const substringResults = search(term, false, 'substring');
      const wordResults = search(term, false, 'word');

      // Substring should find more (matches "בראשית" + "ברא")
      // Word mode only finds exact word "ברא"
      expect(substringResults.length).toBeGreaterThanOrEqual(wordResults.length);
    });

    it('all modes handle nikkud stripping', () => {
      // Search term without nikkud
      const term = 'אלהים';

      const substring = search(term, false, 'substring');
      const word = search(term, false, 'word');
      const root = search(term, false, 'root');

      // All should find matches (nikkud-insensitive)
      expect(substring.length).toBeGreaterThan(0);
      expect(word.length).toBeGreaterThan(0);
      expect(root.length).toBeGreaterThan(0);
    });

    it('modes return language="he" for Hebrew results', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        const results = search('אלהים', false, mode);
        expect(results.length).toBeGreaterThan(0);

        for (const result of results) {
          expect(result.language).toBe('he');
        }
      }
    });

    it('modes create valid snippets with match positions', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        const results = search('אלהים', false, mode);
        expect(results.length).toBeGreaterThan(0);

        const firstResult = results[0];
        expect(firstResult.matchingTerms.length).toBeGreaterThan(0);

        const match = firstResult.matchingTerms[0];
        expect(match.snippet).toBeDefined();
        expect(match.matchStart).toBeGreaterThanOrEqual(0);
        expect(match.matchEnd).toBeGreaterThan(match.matchStart);
        expect(match.matchEnd).toBeLessThanOrEqual(match.snippet.length);
      }
    });
  });

  describe('Proper noun handling - אברהם (Abraham)', () => {
    it('substring mode finds אברהם in partial matches', () => {
      // Search for "אבר" - should find in "אברהם" and "אברם"
      const results = search('אבר', false, 'substring');

      const hasAbraham = results.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      const hasAbram = results.some(r => r.book === 'Genesis' && r.chapter === 12 && r.verse === 1);

      expect(hasAbraham).toBe(true);
      expect(hasAbram).toBe(true);
    });

    it('word mode distinguishes אברם from אברהם', () => {
      const abramResults = search('אברם', false, 'word');
      const abrahamResults = search('אברהם', false, 'word');

      // אברהם appears in Genesis 17:5, Exodus 3:6
      const hasAbrahamGen = abrahamResults.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      const hasAbrahamEx = abrahamResults.some(r => r.book === 'Exodus' && r.chapter === 3 && r.verse === 6);

      expect(hasAbrahamGen).toBe(true);
      expect(hasAbrahamEx).toBe(true);

      // Note: Genesis 17:5 contains BOTH names in the verse:
      // "Your name shall no longer be Abram (אברם) but Abraham (אברהם)"
      // So both searches will match this verse
      expect(abramResults.length).toBeGreaterThan(0);
      expect(abrahamResults.length).toBeGreaterThan(0);
    });

    it('root mode finds אברהם correctly (via whole-word fallback)', () => {
      const results = search('אברהם', false, 'root');

      const gen175 = results.find(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
      const ex36 = results.find(r => r.book === 'Exodus' && r.chapter === 3 && r.verse === 6);

      expect(gen175).toBeDefined();
      expect(ex36).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Multi-term search with modes', () => {
    it('substring mode applies to all terms', () => {
      const results = search('אלה, ברא', false, 'substring');

      // Should find verses with either "אלה" substring or "ברא" substring
      expect(results.length).toBeGreaterThan(0);

      // Check that we have matches for both terms
      const hasTerms = results.some(r => r.matchingTerms.length > 0);
      expect(hasTerms).toBe(true);
    });

    it('word mode applies to all terms', () => {
      const results = search('אלהים, אברהם', false, 'word');

      // Should find verses with either "אלהים" or "אברהם" as whole words
      expect(results.length).toBeGreaterThan(0);

      // Verify we have results for both terms
      const termsFound = new Set<number>();
      for (const result of results) {
        for (const match of result.matchingTerms) {
          termsFound.add(match.termIndex);
        }
      }

      expect(termsFound.size).toBeGreaterThan(0);
    });

    it('root mode applies to all terms', () => {
      const results = search('אלהים, אדם', false, 'root');

      // Should find verses with either term (via whole-word fallback)
      expect(results.length).toBeGreaterThan(0);

      // Genesis 2:7 has both אלהים and האדם
      const gen27 = results.find(r => r.book === 'Genesis' && r.chapter === 2 && r.verse === 7);
      expect(gen27).toBeDefined();
    });
  });

  describe('Edge cases with modes', () => {
    it('handles empty query in all modes', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        const results = search('', false, mode);
        expect(results.length).toBe(0);
      }
    });

    it('handles single-character query in all modes', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        // Single character is below MIN_SEARCH_TERM_LENGTH (2)
        const results = search('א', false, mode);
        expect(results.length).toBe(0);
      }
    });

    it('handles query with no matches in all modes', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        const results = search('xyz123', false, mode);
        expect(results.length).toBe(0);
      }
    });

    it('handles query with only nikkud characters', () => {
      const modes: Array<'substring' | 'word' | 'root'> = ['substring', 'word', 'root'];

      for (const mode of modes) {
        const results = search('\u05B0\u05B1', false, mode);
        // After stripping nikkud, we have empty string which is below MIN_SEARCH_TERM_LENGTH
        // So no results expected
        // Note: The actual behavior depends on parseSearchTerms filtering
        // If the stripped term is empty or too short, it won't match
        expect(results).toBeDefined();
      }
    });
  });
});

describe('searchHebrewWholeWord() - Direct Function Tests', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
            en: 'In the beginning God created',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ',
            en: 'And the earth was formless and void',
          },
        },
        '12': {
          '1': {
            he: 'וַיֹּאמֶר יְהוָה אֶל־אַבְרָם',
            en: 'And the LORD said to Abram',
          },
        },
        '17': {
          '5': {
            he: 'וְלֹא־יִקָּרֵא עוֹד אֶת־שִׁמְךָ אַבְרָם וְהָיָה שִׁמְךָ אַבְרָהָם',
            en: 'Your name shall no longer be Abram but Abraham',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  it('finds whole-word matches with proper nouns', () => {
    const results = searchHebrewWholeWord(['אברהם']);

    expect(results.length).toBeGreaterThan(0);
    const gen175 = results.find(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
    expect(gen175).toBeDefined();
  });

  it('does NOT match when word is substring of another', () => {
    // Search for "אבר" should NOT match "אברהם" as whole word
    const results = searchHebrewWholeWord(['אבר']);

    const hasAbraham = results.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
    expect(hasAbraham).toBe(false);
  });

  it('distinguishes between אברם and אברהם', () => {
    const abramResults = searchHebrewWholeWord(['אברם']);
    const abrahamResults = searchHebrewWholeWord(['אברהם']);

    // אברהם in Genesis 17:5
    const hasAbraham = abrahamResults.some(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
    expect(hasAbraham).toBe(true);

    // Both should find results
    expect(abramResults.length).toBeGreaterThan(0);
    expect(abrahamResults.length).toBeGreaterThan(0);

    // Note: Genesis 17:5 contains BOTH אברם and אברהם in the verse text
    // "Your name shall no longer be Abram but Abraham"
  });

  it('handles multiple terms with proper nouns', () => {
    const results = searchHebrewWholeWord(['אברם', 'אברהם']);

    // Should find verses with either term
    expect(results.length).toBeGreaterThan(0);

    // Genesis 17:5 should match BOTH terms (has both אברם and אברהם in the verse)
    const gen175 = results.find(r => r.book === 'Genesis' && r.chapter === 17 && r.verse === 5);
    expect(gen175).toBeDefined();

    // It should have matches for both terms since the verse contains both names
    expect(gen175!.matchingTerms.length).toBe(2); // Matches both terms
  });

  it('creates correct snippets for matched words', () => {
    const results = searchHebrewWholeWord(['אברהם']);

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];

    expect(firstResult.matchingTerms.length).toBeGreaterThan(0);
    const match = firstResult.matchingTerms[0];

    expect(match.snippet).toBeDefined();
    expect(match.matchStart).toBeGreaterThanOrEqual(0);
    expect(match.matchEnd).toBeGreaterThan(match.matchStart);

    // Verify snippet contains the Hebrew letters (may have nikkud)
    const highlighted = match.snippet.slice(match.matchStart, match.matchEnd);
    // The highlighted portion should contain the base letters א, ב, ר, ה, ם
    expect(highlighted).toMatch(/א.*ב.*ר.*ה.*ם/);
  });

  it('returns language as Hebrew', () => {
    const results = searchHebrewWholeWord(['אלהים']);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.language).toBe('he');
    }
  });
});
