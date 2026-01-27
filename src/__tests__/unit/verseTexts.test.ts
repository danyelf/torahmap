import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAllVerseTexts, getVerseText } from '../../verseTexts';
import type { VerseTexts, VerseText } from '../../verseTexts';
import { SAMPLE_VERSE_TEXTS } from '../helpers';

describe('verseTexts', () => {
  describe('loadAllVerseTexts', () => {
    let fetchMock: any;

    beforeEach(() => {
      // Mock import.meta.env.BASE_URL
      vi.stubGlobal('import', {
        meta: {
          env: {
            BASE_URL: '/'
          }
        }
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (fetchMock) {
        fetchMock.mockRestore();
      }
    });

    describe('successful loading', () => {
      it('loads verse texts from JSON file', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' }
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();
        expect(result).toEqual(mockData);
      });

      it('uses correct URL path with BASE_URL', async () => {
        const fetchSpy = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response)
        );
        global.fetch = fetchSpy;

        await loadAllVerseTexts();

        expect(fetchSpy).toHaveBeenCalledWith('/data/all-texts.json');
      });

      it('uses BASE_URL in the path', async () => {
        // Note: import.meta.env.BASE_URL is resolved at build time
        // In tests it defaults to '/', so we test that behavior
        const fetchSpy = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response)
        );
        global.fetch = fetchSpy;

        await loadAllVerseTexts();

        // In test environment, BASE_URL is '/'
        expect(fetchSpy).toHaveBeenCalledWith('/data/all-texts.json');
      });

      it('returns nested structure with correct hierarchy', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': { he: 'text1', en: 'text1' },
              '2': { he: 'text2', en: 'text2' },
            },
            '2': {
              '1': { he: 'text3', en: 'text3' },
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Genesis']).toBeDefined();
        expect(result['Genesis']['1']).toBeDefined();
        expect(result['Genesis']['1']['1']).toBeDefined();
        expect(result['Genesis']['1']['1'].he).toBe('text1');
        expect(result['Genesis']['1']['1'].en).toBe('text1');
      });

      it('handles large dataset', async () => {
        const largeData: VerseTexts = {};
        // Create 39 books with 50 chapters each, 20 verses per chapter
        for (let b = 1; b <= 39; b++) {
          const bookName = `Book${b}`;
          largeData[bookName] = {};
          for (let c = 1; c <= 50; c++) {
            largeData[bookName][String(c)] = {};
            for (let v = 1; v <= 20; v++) {
              largeData[bookName][String(c)][String(v)] = {
                he: `hebrew${b}-${c}-${v}`,
                en: `english${b}-${c}-${v}`
              };
            }
          }
        }

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(largeData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(Object.keys(result).length).toBe(39);
        expect(result['Book1']['1']['1'].he).toBe('hebrew1-1-1');
      });
    });

    describe('error handling', () => {
      it('handles 404 response', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve(null),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result).toEqual({});
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load verse texts: 404');
        consoleErrorSpy.mockRestore();
      });

      it('handles 500 response', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve(null),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result).toEqual({});
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load verse texts: 500');
        consoleErrorSpy.mockRestore();
      });

      it('handles network error', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 0,
            json: () => Promise.resolve(null),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result).toEqual({});
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load verse texts: 0');
        consoleErrorSpy.mockRestore();
      });

      it('handles fetch rejection', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

        await expect(loadAllVerseTexts()).rejects.toThrow('Network error');
      });

      it('handles invalid JSON response', async () => {
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.reject(new Error('Invalid JSON')),
          } as Response)
        );

        await expect(loadAllVerseTexts()).rejects.toThrow('Invalid JSON');
      });

      it('returns empty object on error (not null)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve(null),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result).not.toBeNull();
        expect(result).toEqual({});
        consoleErrorSpy.mockRestore();
      });
    });

    describe('data structure validation', () => {
      it('preserves Hebrew text with nikkud and trop', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': {
                he: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים',
                en: 'In the beginning God created'
              }
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Genesis']['1']['1'].he).toContain('\u0596'); // Contains trop
        expect(result['Genesis']['1']['1'].he).toContain('\u05B0'); // Contains nikkud
      });

      it('preserves English text with punctuation', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': {
                he: 'text',
                en: 'In the beginning, God created the heaven and the earth.'
              }
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Genesis']['1']['1'].en).toBe(
          'In the beginning, God created the heaven and the earth.'
        );
      });

      it('handles empty Hebrew text', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': { he: '', en: 'Some text' }
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Genesis']['1']['1'].he).toBe('');
        expect(result['Genesis']['1']['1'].en).toBe('Some text');
      });

      it('handles empty English text', async () => {
        const mockData: VerseTexts = {
          'Genesis': {
            '1': {
              '1': { he: 'עברית', en: '' }
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Genesis']['1']['1'].he).toBe('עברית');
        expect(result['Genesis']['1']['1'].en).toBe('');
      });

      it('handles books with mixed chapter/verse ranges', async () => {
        const mockData: VerseTexts = {
          'Psalms': {
            '1': { '1': { he: 'a', en: 'a' } },  // Short chapter
            '119': {  // Long chapter
              '1': { he: 'b', en: 'b' },
              '176': { he: 'c', en: 'c' },  // Last verse
            }
          }
        };

        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockData),
          } as Response)
        );

        const result = await loadAllVerseTexts();

        expect(result['Psalms']['1']['1']).toBeDefined();
        expect(result['Psalms']['119']['176']).toBeDefined();
      });
    });
  });

  describe('getVerseText', () => {
    const mockVerseTexts: VerseTexts = {
      'Genesis': {
        '1': {
          '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' },
          '2': { he: 'וְהָאָרֶץ', en: 'And the earth' },
        },
        '2': {
          '1': { he: 'וַיְכֻלּוּ', en: 'Thus were finished' },
        }
      },
      'Exodus': {
        '1': {
          '1': { he: 'וְאֵלֶּה', en: 'Now these are' },
        }
      },
      'Psalms': {
        '119': {
          '1': { he: 'אַשְׁרֵי', en: 'Blessed are' },
          '176': { he: 'תָּעִיתִי', en: 'I have gone astray' },
        }
      }
    };

    describe('successful retrieval', () => {
      it('retrieves verse text with valid coordinates', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);

        expect(result).not.toBeNull();
        expect(result?.he).toBe('בְּרֵאשִׁית');
        expect(result?.en).toBe('In the beginning');
      });

      it('retrieves verse from different books', () => {
        const genesis = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        const exodus = getVerseText(mockVerseTexts, 'Exodus', 1, 1);

        expect(genesis?.en).toBe('In the beginning');
        expect(exodus?.en).toBe('Now these are');
      });

      it('retrieves verse from different chapters', () => {
        const chapter1 = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        const chapter2 = getVerseText(mockVerseTexts, 'Genesis', 2, 1);

        expect(chapter1?.en).toBe('In the beginning');
        expect(chapter2?.en).toBe('Thus were finished');
      });

      it('retrieves verse from different verse numbers', () => {
        const verse1 = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        const verse2 = getVerseText(mockVerseTexts, 'Genesis', 1, 2);

        expect(verse1?.en).toBe('In the beginning');
        expect(verse2?.en).toBe('And the earth');
      });

      it('retrieves verse with large chapter number', () => {
        const result = getVerseText(mockVerseTexts, 'Psalms', 119, 1);

        expect(result).not.toBeNull();
        expect(result?.en).toBe('Blessed are');
      });

      it('retrieves verse with large verse number', () => {
        const result = getVerseText(mockVerseTexts, 'Psalms', 119, 176);

        expect(result).not.toBeNull();
        expect(result?.en).toBe('I have gone astray');
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

      it('returns null for non-existent chapter', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 50, 1);
        expect(result).toBeNull();
      });

      it('returns null for non-existent verse', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 100);
        expect(result).toBeNull();
      });

      it('returns null for chapter 0', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 0, 1);
        expect(result).toBeNull();
      });

      it('returns null for verse 0', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 0);
        expect(result).toBeNull();
      });

      it('returns null for negative chapter', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', -1, 1);
        expect(result).toBeNull();
      });

      it('returns null for negative verse', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, -1);
        expect(result).toBeNull();
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
              '1': { he: 'שִׁיר', en: 'The song' }
            }
          }
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
              '1': { he: '', en: 'English only' }
            }
          }
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toBe('');
        expect(result?.en).toBe('English only');
      });

      it('handles verse with empty English text', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: 'עברית בלבד', en: '' }
            }
          }
        };

        const result = getVerseText(verseTexts, 'Test', 1, 1);
        expect(result?.he).toBe('עברית בלבד');
        expect(result?.en).toBe('');
      });

      it('handles verse with both texts empty', () => {
        const verseTexts: VerseTexts = {
          'Test': {
            '1': {
              '1': { he: '', en: '' }
            }
          }
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
              '1': { he: longText, en: longText }
            }
          }
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
                en: 'English with "quotes" and \'apostrophes\''
              }
            }
          }
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
                en: 'English 📖'
              }
            }
          }
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

      it('accepts chapter as number', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        expect(result).not.toBeNull();
      });

      it('accepts verse as number', () => {
        const result = getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        expect(result).not.toBeNull();
      });

      it('handles fractional chapter numbers by conversion', () => {
        // JavaScript will convert 1.5 to "1" in object lookup
        const result = getVerseText(mockVerseTexts, 'Genesis', 1.5 as any, 1);
        // This might return chapter 1 or null depending on implementation
        // The function uses String() conversion which truncates
        expect(result).toBeDefined(); // Not throwing is the key
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
      it('handles rapid sequential lookups', () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
          getVerseText(mockVerseTexts, 'Genesis', 1, 1);
        }

        const duration = performance.now() - start;
        // Should complete 1000 lookups in < 10ms
        expect(duration).toBeLessThan(10);
      });

      it('handles lookups across many verses', () => {
        const largeData: VerseTexts = {
          'Book': {}
        };

        // Create 150 chapters with 50 verses each
        for (let c = 1; c <= 150; c++) {
          largeData['Book'][String(c)] = {};
          for (let v = 1; v <= 50; v++) {
            largeData['Book'][String(c)][String(v)] = {
              he: `he-${c}-${v}`,
              en: `en-${c}-${v}`
            };
          }
        }

        const start = performance.now();
        const result = getVerseText(largeData, 'Book', 150, 50);
        const duration = performance.now() - start;

        expect(result?.en).toBe('en-150-50');
        expect(duration).toBeLessThan(1); // Should be instant
      });
    });
  });

  describe('integration: loadAllVerseTexts + getVerseText', () => {
    it('can load and then retrieve verses', async () => {
      const mockData: VerseTexts = {
        'Genesis': {
          '1': {
            '1': { he: 'בְּרֵאשִׁית', en: 'In the beginning' }
          }
        }
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockData),
        } as Response)
      );

      const verseTexts = await loadAllVerseTexts();
      const verse = getVerseText(verseTexts, 'Genesis', 1, 1);

      expect(verse).not.toBeNull();
      expect(verse?.he).toBe('בְּרֵאשִׁית');
      expect(verse?.en).toBe('In the beginning');
    });

    it('handles load failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve(null),
        } as Response)
      );

      const verseTexts = await loadAllVerseTexts();
      const verse = getVerseText(verseTexts, 'Genesis', 1, 1);

      expect(verse).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('works with complete workflow', async () => {
      const mockData: VerseTexts = {
        'Genesis': {
          '1': {
            '1': { he: 'verse1', en: 'verse1' },
            '2': { he: 'verse2', en: 'verse2' },
          }
        },
        'Exodus': {
          '1': {
            '1': { he: 'verse3', en: 'verse3' }
          }
        }
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockData),
        } as Response)
      );

      const verseTexts = await loadAllVerseTexts();

      // Retrieve multiple verses
      const gen1_1 = getVerseText(verseTexts, 'Genesis', 1, 1);
      const gen1_2 = getVerseText(verseTexts, 'Genesis', 1, 2);
      const ex1_1 = getVerseText(verseTexts, 'Exodus', 1, 1);
      const missing = getVerseText(verseTexts, 'Leviticus', 1, 1);

      expect(gen1_1?.en).toBe('verse1');
      expect(gen1_2?.en).toBe('verse2');
      expect(ex1_1?.en).toBe('verse3');
      expect(missing).toBeNull();
    });
  });
});
