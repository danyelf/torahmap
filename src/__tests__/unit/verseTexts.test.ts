import { describe, it, expect } from 'vitest';
import { getVerseText } from '../../verseTexts';
import type { VerseTexts } from '../../verseTexts';
import { SAMPLE_VERSE_TEXTS } from '../helpers';

describe('verseTexts', () => {
  describe('getVerseText', () => {
    const mockVerseTexts: VerseTexts = {
      'Genesis': {
        '1': {
          '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' },
          '2': { he: 'וְהָאָרֶץ', en: 'And the earth' },
        },
        '2': {
          '1': { he: 'וַיְכֻלּוּ', en: 'Thus were finished' },
        },
      },
      'Exodus': {
        '1': {
          '1': { he: 'וְאֵלֶּה', en: 'Now these are' },
        },
      },
      'Psalms': {
        '119': {
          '1': { he: 'אַשְׁרֵי', en: 'Blessed are' },
          '176': { he: 'תָּעִיתִי', en: 'I have gone astray' },
        },
      },
    };

    describe('successful retrieval', () => {
      it('retrieves verse text with valid coordinates', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);

        expect(result).not.toBeNull();
        expect(result?.he).toBe('בְּרֵאשִׁית');
        expect(result?.en).toBe('In the beginning');
      });

      it('retrieves verses varying by book, chapter and verse number', () => {
        expect(getVerseText(mockVerseTexts, 'Genesis', 1, 1)?.en).toBe('In the beginning');
        expect(getVerseText(mockVerseTexts, 'Exodus', 1, 1)?.en).toBe('Now these are');
        expect(getVerseText(mockVerseTexts, 'Genesis', 2, 1)?.en).toBe('Thus were finished');
        expect(getVerseText(mockVerseTexts, 'Genesis', 1, 2)?.en).toBe('And the earth');
        expect(getVerseText(mockVerseTexts, 'Psalms', 119, 1)?.en).toBe('Blessed are');
        expect(getVerseText(mockVerseTexts, 'Psalms', 119, 176)?.en).toBe('I have gone astray');
      });

      it('returns object with both he and en properties', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);

        expect(result).toHaveProperty('he');
        expect(result).toHaveProperty('en');
        expect(typeof result?.he).toBe('string');
        expect(typeof result?.en).toBe('string');
      });
    });

    describe('missing data handling', () => {
      it('returns null for non-existent book', () => {
        const result = getVerseText(mockVerseTexts, 'Leviticus', 1, 1);
        expect(result).toBeNull();
      });

      it('returns null for any chapter number that has no matching key (missing, zero, negative)', () => {
        expect(getVerseText(mockVerseTexts, 'Genesis', 50, 1)).toBeNull();
        expect(getVerseText(mockVerseTexts, 'Genesis', 0, 1)).toBeNull();
        expect(getVerseText(mockVerseTexts, 'Genesis', -1, 1)).toBeNull();
      });

      it('returns null for any verse number that has no matching key (missing, zero, negative)', () => {
        expect(getVerseText(mockVerseTexts, 'Genesis', 1, 100)).toBeNull();
        expect(getVerseText(mockVerseTexts, 'Genesis', 1, 0)).toBeNull();
        expect(getVerseText(mockVerseTexts, 'Genesis', 1, -1)).toBeNull();
      });

      it('returns null for empty book name', () => {
        const result = getVerseText(mockVerseTexts, '', 1, 1);
        expect(result).toBeNull();
      });

      it('returns null when verseTexts is empty', () => {
        const result = getVerseText({}, 'Genesis', 1, 1);
        expect(result).toBeNull();
      });

      it('handles book name with different casing', () => {
        // Book names are case-sensitive
        const result = getVerseText(mockVerseTexts, 'genesis', 1, 1);
        expect(result).toBeNull();
      });

      it('handles book name with spaces', () => {
        const verseTexts: VerseTexts = {
          'Song of Songs': {
            '1': {
              '1': { he: 'שִׁיר', en: 'The song' },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Song of Songs', 1, 1);
        expect(result).not.toBeNull();
        expect(result?.en).toBe('The song');
      });
    });

    describe('edge cases', () => {
      it('handles verse with empty Hebrew text', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: '', en: 'English only' },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toBe('');
        expect(result?.en).toBe('English only');
      });

      it('handles verse with empty English text', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: 'עברית בלבד', en: '' },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toBe('עברית בלבד');
        expect(result?.en).toBe('');
      });

      it('handles verse with both texts empty', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: '', en: '' },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toBe('');
        expect(result?.en).toBe('');
      });

      it('handles very long text content', () => {
        const longText = 'a'.repeat(10000);
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: longText, en: longText },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he.length).toBe(10000);
        expect(result?.en.length).toBe(10000);
      });

      it('handles special characters in text', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': {
                he: 'עברית עם ״ציטוט״',
                en: 'English with "quotes" and \'apostrophes\'',
              },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toContain('״');
        expect(result?.en).toContain('"');
        expect(result?.en).toContain("'");
      });

      it('handles Unicode characters in text', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': {
                he: 'עברית 🙏',
                en: 'English 📖',
              },
            },
          },
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toContain('🙏');
        expect(result?.en).toContain('📖');
      });

      it('does not modify input verseTexts object', () => {
        const original = JSON.stringify(mockVerseTexts);
        getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        const after = JSON.stringify(mockVerseTexts);

        expect(after).toBe(original);
      });

      it('returns same result for repeated calls', () => {
        const result1 = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        const result2 = getVerseText(mockVerseTexts, 'Genesis', 1, 1);

        expect(result1).toEqual(result2);
      });
    });

    describe('type safety', () => {
      it('returns VerseText type with correct properties', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);

        if (result) {
          // TypeScript should recognize these properties
          const he: string = result.he;
          const en: string = result.en;
          expect(typeof he).toBe('string');
          expect(typeof en).toBe('string');
        }
      });

      it('returns null for a fractional chapter number (no chapter key matches "1.5")', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1.5 as any, 1);
        expect(result).toBeNull();
      });
    });

    describe('integration with SAMPLE_VERSE_TEXTS', () => {
      it('retrieves Genesis 1:1 from sample data', () => {
        const result = getVerseText(SAMPLE_VERSE_TEXTS, 'Genesis', 1, 1);

        expect(result).not.toBeNull();
        expect(result?.he).toContain('בְּרֵאשִׁ֖ית');
        expect(result?.en).toContain('In the beginning');
      });

      it('retrieves Genesis 1:2 from sample data', () => {
        const result = getVerseText(SAMPLE_VERSE_TEXTS, 'Genesis', 1, 2);

        expect(result).not.toBeNull();
        expect(result?.he).toContain('וְהָאָ֗רֶץ');
        expect(result?.en).toContain('without form');
      });

      it('retrieves Isaiah 1:1 from sample data', () => {
        const result = getVerseText(SAMPLE_VERSE_TEXTS, 'Isaiah', 1, 1);

        expect(result).not.toBeNull();
        expect(result?.he).toContain('יְשַֽׁעְיָ֛הוּ');
        expect(result?.en).toContain('Isaiah');
      });

      it('returns null for non-existent verse in sample data', () => {
        const result = getVerseText(SAMPLE_VERSE_TEXTS, 'Genesis', 50, 1);
        expect(result).toBeNull();
      });
    });

    describe('performance', () => {
      it('handles lookups across many verses', () => {
        const largeData: VerseTexts = {
          'Book': {},
        };

        // Create 150 chapters with 50 verses each
        for (let c = 1; c <= 150; c++) {
          largeData['Book'][String(c)] = {};
          for (let v = 1; v <= 50; v++) {
            largeData['Book'][String(c)][String(v)] = {
              he: `he-${c}-${v}`,
              en: `en-${c}-${v}`,
            };
          }
        }

        const result = getVerseText(largeData, 'Book', 150, 50);

        expect(result?.en).toBe('en-150-50');
      });
    });
  });
});
