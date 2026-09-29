// Tests for whole-word search functionality
import { describe, it, expect, beforeEach } from 'vitest';
import { buildSearchIndex, versesForTerm } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Whole Word Search', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with specific words that can test substring vs whole-word
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
            en: 'In the beginning God created the heavens',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ',
            en: 'And the earth was without form and void',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'God said let there be light',
          },
        },
        '2': {
          '1': {
            he: 'וַיְכֻלּוּ הַשָּׁמַיִם',
            en: 'The heavens were finished',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵלֶּה שְׁמוֹת',
            en: 'Now these are the names of Israel',
          },
          '2': {
            he: 'רְאוּבֵן שִׁמְעוֹן',
            en: 'Reuben and Simeon',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  const english = (text: string, mode: 'substring' | 'word') =>
    [...versesForTerm(text, 'en', mode)].sort();
  const hebrew = (text: string) => [...versesForTerm(text, 'he', 'word')].sort();

  describe('English substring vs whole word', () => {
    it('substring finds "heaven" in "heavens"', () => {
      expect(english('heaven', 'substring')).toEqual(['Genesis:1:1', 'Genesis:2:1']);
    });

    it('whole word does not find "heaven" in "heavens"', () => {
      expect(english('heaven', 'word')).toEqual([]);
    });

    it('whole word finds "heavens"', () => {
      expect(english('heavens', 'word')).toEqual(['Genesis:1:1', 'Genesis:2:1']);
    });

    it('whole word finds "the" but not "there"', () => {
      // Genesis 1:3: "God said let there be light"
      expect(english('the', 'substring')).toContain('Genesis:1:3');
      expect(english('the', 'word')).not.toContain('Genesis:1:3');
    });

    it('whole word is bounded by punctuation', () => {
      buildSearchIndex({ Genesis: { '1': { '1': { he: 'א', en: 'said God, let' } } } });
      expect(english('god', 'word')).toEqual(['Genesis:1:1']);
    });

    it('ignores case', () => {
      expect(english('GOD', 'word')).toEqual(english('god', 'word'));
      expect(english('God', 'word')).toEqual(english('god', 'word'));
    });

    it('substring finds "ear" in "earth", whole word does not', () => {
      expect(english('ear', 'substring')).toContain('Genesis:1:2');
      expect(english('ear', 'word')).not.toContain('Genesis:1:2');
    });
  });

  describe('Hebrew whole word', () => {
    it('finds a word written with points', () => {
      expect(hebrew('אלהים')).toEqual(['Genesis:1:1', 'Genesis:1:3']);
      expect(hebrew('ברא')).toEqual(['Genesis:1:1']);
    });

    it('finds the first word of a verse', () => {
      expect(hebrew('בראשית')).toEqual(['Genesis:1:1']);
    });

    it('does not match part of a word', () => {
      expect(hebrew('אלה')).toEqual([]);
    });

    it('finds nothing for a word that is not there', () => {
      expect(hebrew('xyz123')).toEqual([]);
    });
  });
});
