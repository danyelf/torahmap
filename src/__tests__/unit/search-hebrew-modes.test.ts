// Tests for Hebrew search modes (substring, word, meanings)
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTextIndex, type TextIndex, versesForTerm } from '../../search';
import type { MatchMode } from '../../search/matching';
import type { VerseTexts } from '../../verseTexts';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { EMPTY_DICTIONARY } from '../helpers/searchData';

describe('Hebrew Search Modes', () => {
  let mockVerseTexts: VerseTexts;
  let index: TextIndex;

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

    index = buildTextIndex(mockVerseTexts);
  });

  const found = (text: string, mode: MatchMode) => versesForTerm(index, text, 'he', mode);

  describe('substring mode', () => {
    it('matches inside a longer word', () => {
      // "אלה" inside "ואלה" (Exodus 1:1)
      expect(found('אלה', 'substring').has('Exodus:1:1')).toBe(true);
    });

    it('matches "ברא" in "בראשית" and "ברא"', () => {
      expect(found('ברא', 'substring').has('Genesis:1:1')).toBe(true);
    });

    it('finds "אבר" in both "אברהם" and "אברם"', () => {
      const verses = found('אבר', 'substring');
      expect(verses.has('Genesis:12:1')).toBe(true);
      expect(verses.has('Genesis:17:5')).toBe(true);
    });
  });

  describe('word mode', () => {
    it('does not match part of a word', () => {
      // "ואלה" is one word, prefix and all.
      expect(found('אלה', 'word').has('Exodus:1:1')).toBe(false);
    });

    it('matches a whole word written with points', () => {
      expect(found('אלהים', 'word').has('Genesis:1:1')).toBe(true);
    });

    it('tells אברם from אברהם', () => {
      const abraham = found('אברהם', 'word');
      expect([...abraham].sort()).toEqual(['Exodus:3:6', 'Genesis:17:5']);
      // Genesis 17:5 names both.
      expect([...found('אברם', 'word')].sort()).toEqual(['Genesis:12:1', 'Genesis:17:5']);
    });

    it('does not match "אבר" inside "אברהם"', () => {
      expect(found('אבר', 'word').size).toBe(0);
    });

    it('finds fewer verses than substring mode', () => {
      expect(found('ברא', 'word').size).toBeLessThanOrEqual(found('ברא', 'substring').size);
    });
  });

  describe('edge cases', () => {
    it('finds nothing for an empty term', () => {
      for (const mode of ['substring', 'word'] as const) {
        expect(found('', mode).size).toBe(0);
      }
      expect(searchInMeaningsMode(index, EMPTY_DICTIONARY, '')).toEqual([]);
    });

    it('finds nothing for a single letter in meanings mode', () => {
      expect(searchInMeaningsMode(index, EMPTY_DICTIONARY, 'א')).toEqual([]);
    });

    it('finds nothing for a term with no matches', () => {
      for (const mode of ['substring', 'word'] as const) {
        expect(found('xyz123', mode).size).toBe(0);
      }
      expect(searchInMeaningsMode(index, EMPTY_DICTIONARY, 'xyz123')).toEqual([]);
    });

    it('finds nothing for a term of points alone', () => {
      for (const mode of ['substring', 'word'] as const) {
        expect(found('\u05B0\u05B1', mode).size).toBe(0);
      }
    });
  });
});
