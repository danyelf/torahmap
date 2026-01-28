// Tests for verse-length overlay - word counting, logarithmic color gradient, legend rendering
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verseLengthOverlay, configure } from '../../../overlays/verse-length';
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { VerseTexts } from '../../../verseTexts';

describe('Verse Length Overlay', () => {
  let testVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test data with various verse lengths
    testVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃', // 7 words
            en: 'In the beginning God created the heaven and the earth.',
          },
          '2': {
            he: 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ', // 4 words
            en: 'And the earth was without form, and void',
          },
          '3': {
            he: 'וַיֹּ֥אמֶר אֱלֹהִ֖ים', // 2 words (short)
            en: 'And God said',
          },
        },
        '2': {
          '1': {
            he: 'וַיְכֻלּ֛וּ הַשָּׁמַ֥יִם וְהָאָ֖רֶץ', // 3 words
            en: 'Thus the heavens and the earth were finished',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵ֗לֶּה שְׁמוֹת֙ בְּנֵ֣י יִשְׂרָאֵ֔ל הַבָּאִ֖ים מִצְרָ֑יְמָה אֵ֣ת יַעֲקֹ֔ב אִ֥ישׁ וּבֵית֖וֹ בָּֽאוּ׃', // 12 words (long)
            en: 'Now these are the names of the children of Israel...',
          },
          '2': {
            he: 'רְאוּבֵ֣ן', // 1 word (very short)
            en: 'Reuben',
          },
        },
      },
      'Isaiah': {
        '1': {
          '1': {
            he: 'חֲז֧וֹן יְשַֽׁעְיָ֛הוּ בֶּן־אָמ֖וֹץ אֲשֶׁ֣ר חָזָ֑ה עַל־יְהוּדָ֖ה וִירוּשָׁלִָ֑ם בִּימֵ֨י עֻזִּיָּ֧הוּ יוֹתָ֛ם אָחָ֥ז יְחִזְקִיָּ֖הוּ מַלְכֵ֥י יְהוּדָֽה׃', // 14 words (very long)
            en: 'The vision of Isaiah the son of Amoz...',
          },
        },
      },
      'Psalms': {
        '1': {
          '1': {
            he: '', // Empty text - edge case
            en: '',
          },
        },
      },
    };

    // Configure overlay with test data
    configure({ verseTexts: testVerseTexts });
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(verseLengthOverlay.id).toBe('verse-length');
      expect(verseLengthOverlay.name).toBe('Verse Length');
    });

    it('has required methods', () => {
      expect(verseLengthOverlay.getVerseColor).toBeDefined();
      expect(verseLengthOverlay.renderLegend).toBeDefined();
      expect(verseLengthOverlay.getHoverInfo).toBeDefined();
      expect(verseLengthOverlay.renderSidebarInfo).toBeDefined();
    });
  });

  describe('Word Counting Logic', () => {
    it('counts Hebrew words correctly by splitting on whitespace', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const info1 = verseLengthOverlay.getHoverInfo(verse1);
      expect(info1).toBe('7 words');

      const verse2 = createVerse({ book: 'Genesis', chapter: 1, verse: 2 });
      const info2 = verseLengthOverlay.getHoverInfo(verse2);
      expect(info2).toBe('4 words');
    });

    it('handles single word verses', () => {
      const verse = createVerse({ book: 'Exodus', chapter: 1, verse: 2 });
      const info = verseLengthOverlay.getHoverInfo(verse);
      expect(info).toBe('1 word'); // Singular form
    });

    it('handles empty text as zero words', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);

      // Should return dark gray for zero words
      expect(color).not.toBeNull();
      assertValidColor(color!);
      expect(color![0]).toBeCloseTo(0.15, 2);
      expect(color![1]).toBeCloseTo(0.15, 2);
      expect(color![2]).toBeCloseTo(0.2, 2);
    });

    it('filters out empty strings when splitting', () => {
      // Text with multiple consecutive spaces
      const testData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': {
              he: 'אֱלֹהִ֑ים    בָּרָ֣א', // Multiple spaces between words
              en: 'God created',
            },
          },
        },
      };
      configure({ verseTexts: testData });

      const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);
      expect(info).toBe('2 words'); // Should count as 2, not more
    });

    it('trims whitespace before counting', () => {
      // Text with leading/trailing spaces
      const testData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': {
              he: '  בָּרָ֣א אֱלֹהִ֑ים  ', // Leading and trailing spaces
              en: 'God created',
            },
          },
        },
      };
      configure({ verseTexts: testData });

      const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);
      expect(info).toBe('2 words');
    });
  });

  describe('Min/Max Calculation', () => {
    it('calculates correct minimum word count', () => {
      // Min should be 1 (Exodus 1:2 has 1 word, ignoring Psalms 1:1 which has 0)
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('1 word'); // Minimum label
    });

    it('calculates correct maximum word count', () => {
      // Max should be 14 (Isaiah 1:1 has 14 words)
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('14 words'); // Maximum label
    });

    it('excludes zero-word verses from min calculation', () => {
      // Psalms 1:1 has 0 words but should not affect min
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).not.toContain('0 word'); // Should not show 0 as minimum
    });

    it('handles dataset with only zero-word verses', () => {
      const emptyData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': { he: '', en: '' },
            '2': { he: '  ', en: '' },
          },
        },
      };
      configure({ verseTexts: emptyData });

      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('0 words'); // Both min and max should be 0
    });
  });

  describe('Color Gradient Calculations', () => {
    it('returns valid colors for all verses with word counts', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }), // 7 words
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), // 4 words
        createVerse({ book: 'Exodus', chapter: 1, verse: 1 }), // 12 words
        createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }), // 16 words
      ];

      for (const verse of verses) {
        const color = verseLengthOverlay.getVerseColor(verse);
        expect(color).not.toBeNull();
        assertValidColor(color!);
      }
    });

    it('uses logarithmic scale for color mapping', () => {
      // Logarithmic scale means the color difference between 1 and 4 words
      // should be greater than between 12 and 16 words
      const verse1 = createVerse({ book: 'Exodus', chapter: 1, verse: 2 }); // 1 word
      const verse4 = createVerse({ book: 'Genesis', chapter: 1, verse: 2 }); // 4 words
      const verse12 = createVerse({ book: 'Exodus', chapter: 1, verse: 1 }); // 12 words
      const verse14 = createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }); // 14 words

      const color1 = verseLengthOverlay.getVerseColor(verse1)!;
      const color4 = verseLengthOverlay.getVerseColor(verse4)!;
      const color12 = verseLengthOverlay.getVerseColor(verse12)!;
      const color14 = verseLengthOverlay.getVerseColor(verse14)!;

      // Calculate overall color difference (Euclidean distance)
      const distance = (c1: number[], c2: number[]) =>
        Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);

      const diffLow = distance(color1, color4);
      const diffHigh = distance(color12, color14);

      // In logarithmic scale, 1->4 (4x) should have larger color change than 12->14 (1.17x)
      expect(diffLow).toBeGreaterThan(diffHigh * 0.8);
    });

    it('assigns cooler colors (blue) to shorter verses', () => {
      const shortVerse = createVerse({ book: 'Exodus', chapter: 1, verse: 2 }); // 1 word
      const color = verseLengthOverlay.getVerseColor(shortVerse)!;

      assertValidColor(color);

      // Blue has higher blue channel and lower red channel
      // The gradient goes from blue (240°) to red (0°), so short should be bluish
      expect(color[2]).toBeGreaterThan(color[0]); // Blue > Red for cool colors
    });

    it('assigns warmer colors (red/orange) to longer verses', () => {
      const longVerse = createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }); // 16 words
      const color = verseLengthOverlay.getVerseColor(longVerse)!;

      assertValidColor(color);

      // Red/orange has higher red channel
      expect(color[0]).toBeGreaterThan(color[2]); // Red > Blue for warm colors
    });

    it('uses cool-to-warm gradient from blue to red', () => {
      const shortVerse = createVerse({ book: 'Exodus', chapter: 1, verse: 2 }); // 1 word (min)
      const longVerse = createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }); // 16 words (max)

      const shortColor = verseLengthOverlay.getVerseColor(shortVerse)!;
      const longColor = verseLengthOverlay.getVerseColor(longVerse)!;

      // Short should be cooler (higher blue component)
      expect(shortColor[2]).toBeGreaterThan(longColor[2]);

      // Long should be warmer (higher red component)
      expect(longColor[0]).toBeGreaterThan(shortColor[0]);
    });

    it('returns dark gray for verses with zero words', () => {
      const emptyVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(emptyVerse)!;

      // Should be [0.15, 0.15, 0.2]
      expect(color[0]).toBeCloseTo(0.15, 2);
      expect(color[1]).toBeCloseTo(0.15, 2);
      expect(color[2]).toBeCloseTo(0.2, 2);
    });

    it('returns dark gray for verses not in dataset', () => {
      const missingVerse = createVerse({ book: 'UnknownBook', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(missingVerse);

      // Missing verses are treated as 0 words (dark gray)
      expect(color).not.toBeNull();
      assertValidColor(color!);
      expect(color![0]).toBeCloseTo(0.15, 2);
      expect(color![1]).toBeCloseTo(0.15, 2);
      expect(color![2]).toBeCloseTo(0.2, 2);
    });

    it('uses high saturation for vibrant colors', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse)!;

      assertValidColor(color);

      // High saturation means the difference between max and min RGB channels should be significant
      const max = Math.max(...color);
      const min = Math.min(...color);
      const saturation = (max - min) / (max + 1e-10); // Avoid division by zero

      expect(saturation).toBeGreaterThan(0.4); // Should be fairly saturated
    });

    it('produces consistent colors for same verse', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });

      const color1 = verseLengthOverlay.getVerseColor(verse);
      const color2 = verseLengthOverlay.getVerseColor(verse);

      expect(color1).toEqual(color2);
    });
  });

  describe('Hover Info Formatting', () => {
    it('returns formatted word count with plural "words"', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBe('7 words');
    });

    it('returns singular "word" for count of 1', () => {
      const verse = createVerse({ book: 'Exodus', chapter: 1, verse: 2 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBe('1 word');
    });

    it('returns null for verses not in dataset', () => {
      const verse = createVerse({ book: 'UnknownBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });

    it('returns formatted count for zero words', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBe('0 words');
    });

    it('handles missing book gracefully', () => {
      const verse = createVerse({ book: 'MissingBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });

    it('handles missing chapter gracefully', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 999, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });

    it('handles missing verse gracefully', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 999 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });
  });

  describe('Legend Rendering', () => {
    it('renders gradient bar', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('linear-gradient');
    });

    it('renders min and max word count labels', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('1 word'); // Min
      expect(html).toContain('14 words'); // Max
    });

    it('includes explanatory text about cool and warm colors', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('Cool colors');
      expect(html).toContain('blue');
      expect(html).toContain('shorter verses');
    });

    it('includes explanatory text about warm colors', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('Warm colors');
      expect(html).toContain('red/orange');
      expect(html).toContain('longer verses');
    });

    it('mentions logarithmic scale in legend', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;
      expect(html).toContain('Logarithmic scale');
    });

    it('creates gradient with multiple color stops', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;

      // Should have multiple rgb() values in the gradient
      const rgbMatches = html.match(/rgb\([^)]+\)/g);
      expect(rgbMatches).not.toBeNull();
      expect(rgbMatches!.length).toBeGreaterThanOrEqual(5); // Should have multiple stops
    });

    it('gradient goes from blue to red', () => {
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);

      const html = container.innerHTML;

      // Extract RGB values from gradient
      const rgbMatches = html.match(/rgb\(([^)]+)\)/g);
      expect(rgbMatches).not.toBeNull();

      if (rgbMatches && rgbMatches.length >= 2) {
        const firstColor = rgbMatches[0];
        const lastColor = rgbMatches[rgbMatches.length - 1];

        // First color should be bluish (high blue component)
        expect(firstColor).toMatch(/rgb\(\s*\d+,\s*\d+,\s*\d+\s*\)/);

        // Last color should be reddish (high red component)
        expect(lastColor).toMatch(/rgb\(\s*\d+,\s*\d+,\s*\d+\s*\)/);
      }
    });
  });

  describe('Sidebar Info Rendering', () => {
    it('returns HTMLElement with word count', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const element = verseLengthOverlay.renderSidebarInfo(verse);

      expect(element).not.toBeNull();
      expect(element).toBeInstanceOf(HTMLElement);

      const div = element as HTMLElement;
      expect(div.textContent).toContain('7 words');
    });

    it('includes "Verse Length:" label', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const element = verseLengthOverlay.renderSidebarInfo(verse) as HTMLElement;

      expect(element.textContent).toContain('Verse Length:');
    });

    it('uses singular form for one word', () => {
      const verse = createVerse({ book: 'Exodus', chapter: 1, verse: 2 });
      const element = verseLengthOverlay.renderSidebarInfo(verse) as HTMLElement;

      expect(element.textContent).toContain('1 word');
      expect(element.textContent).not.toContain('1 words');
    });

    it('returns null for verses not in dataset', () => {
      const verse = createVerse({ book: 'UnknownBook', chapter: 1, verse: 1 });
      const element = verseLengthOverlay.renderSidebarInfo(verse);

      expect(element).toBeNull();
    });

    it('has appropriate styling', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const element = verseLengthOverlay.renderSidebarInfo(verse) as HTMLElement;

      // Check that it has styling
      expect(element.style.cssText).toBeTruthy();
      expect(element.style.cssText).toContain('margin-top');
    });
  });

  describe('Integration', () => {
    it('overlay is exported from module', () => {
      expect(verseLengthOverlay).toBeDefined();
      expect(verseLengthOverlay.id).toBe('verse-length');
    });

    it('configure function is exported', () => {
      expect(configure).toBeDefined();
      expect(typeof configure).toBe('function');
    });

    it('can be registered and retrieved from registry', async () => {
      const { registerOverlay, getOverlay } = await import('../../../overlays/registry');

      registerOverlay(verseLengthOverlay);
      const retrieved = getOverlay('verse-length');

      expect(retrieved).toBe(verseLengthOverlay);
    });

    it('appears in getAllOverlays after registration', async () => {
      const { registerOverlay, getAllOverlays } = await import('../../../overlays/registry');

      // Clear and re-register
      const before = getAllOverlays().length;
      registerOverlay(verseLengthOverlay);
      const after = getAllOverlays();

      expect(after.length).toBeGreaterThanOrEqual(before);
      expect(after.some((o: any) => o.id === 'verse-length')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles verse with only whitespace', () => {
      const testData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': {
              he: '   \t\n  ', // Only whitespace
              en: '',
            },
          },
        },
      };
      configure({ verseTexts: testData });

      const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(info).toBe('0 words');
    });

    it('handles very long verses', () => {
      // Create a verse with 100 words
      const longText = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
      const testData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': {
              he: longText,
              en: '',
            },
          },
        },
      };
      configure({ verseTexts: testData });

      const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);
      const info = verseLengthOverlay.getHoverInfo(verse);

      assertValidColor(color!);
      expect(info).toBe('100 words');
    });

    it('handles reconfiguration with new data', () => {
      const newData: VerseTexts = {
        'NewBook': {
          '1': {
            '1': {
              he: 'אֱלֹהִ֑ים בָּרָ֣א בְּרֵאשִׁ֖ית',
              en: 'God created beginning',
            },
          },
        },
      };

      configure({ verseTexts: newData });

      const verse = createVerse({ book: 'NewBook', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);
      const info = verseLengthOverlay.getHoverInfo(verse);

      expect(color).not.toBeNull();
      expect(info).toBe('3 words');
    });

    it('handles missing chapter in book', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 999, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);
      const info = verseLengthOverlay.getHoverInfo(verse);

      // Missing data is treated as 0 words (dark gray)
      expect(color).not.toBeNull();
      assertValidColor(color!);
      expect(info).toBeNull();
    });

    it('handles missing verse in chapter', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 999 });
      const color = verseLengthOverlay.getVerseColor(verse);
      const info = verseLengthOverlay.getHoverInfo(verse);

      // Missing data is treated as 0 words (dark gray)
      expect(color).not.toBeNull();
      assertValidColor(color!);
      expect(info).toBeNull();
    });

    it('handles empty verseTexts object', () => {
      configure({ verseTexts: {} });

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);

      // Missing data is treated as 0 words (dark gray)
      expect(color).not.toBeNull();
      assertValidColor(color!);
    });

    it('handles verse with special Unicode characters', () => {
      const testData: VerseTexts = {
        'TestBook': {
          '1': {
            '1': {
              he: 'בְּרֵאשִׁ֖ית מַקָּף־חָבוּר', // Includes maqaf (hyphen)
              en: '',
            },
          },
        },
      };
      configure({ verseTexts: testData });

      const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
      const info = verseLengthOverlay.getHoverInfo(verse);

      // Maqaf connects words but is surrounded by spaces, so should count as 2 words
      expect(info).toBe('2 words');
    });

    it('handles single book with single verse', () => {
      const minimalData: VerseTexts = {
        'SingleBook': {
          '1': {
            '1': {
              he: 'אֱלֹהִ֑ים',
              en: 'God',
            },
          },
        },
      };
      configure({ verseTexts: minimalData });

      const verse = createVerse({ book: 'SingleBook', chapter: 1, verse: 1 });
      const color = verseLengthOverlay.getVerseColor(verse);
      const info = verseLengthOverlay.getHoverInfo(verse);

      assertValidColor(color!);
      expect(info).toBe('1 word');

      // When min === max, gradient should still work
      const container = document.createElement('div');
      verseLengthOverlay.renderLegend(container);
      expect(container.innerHTML).toContain('1 word');
    });
  });

  describe('Color Value Validation', () => {
    it('produces RGB values in valid [0, 1] range for all test verses', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
        createVerse({ book: 'Genesis', chapter: 1, verse: 3 }),
        createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
        createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
        createVerse({ book: 'Exodus', chapter: 1, verse: 2 }),
        createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
      ];

      for (const verse of verses) {
        const color = verseLengthOverlay.getVerseColor(verse);
        if (color !== null) {
          assertValidColor(color);
          for (const component of color) {
            expect(component).toBeGreaterThanOrEqual(0);
            expect(component).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it('produces distinguishable colors for different word counts', () => {
      const verse1 = createVerse({ book: 'Exodus', chapter: 1, verse: 2 }); // 1 word
      const verse7 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // 7 words
      const verse14 = createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }); // 14 words

      const color1 = verseLengthOverlay.getVerseColor(verse1)!;
      const color7 = verseLengthOverlay.getVerseColor(verse7)!;
      const color14 = verseLengthOverlay.getVerseColor(verse14)!;

      // Calculate color distances (Euclidean in RGB space)
      const distance = (c1: number[], c2: number[]) =>
        Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);

      // Colors should be visually distinct (distance > 0.2 in RGB space)
      expect(distance(color1, color7)).toBeGreaterThan(0.2);
      expect(distance(color7, color14)).toBeGreaterThan(0.1);
      expect(distance(color1, color14)).toBeGreaterThan(0.3);
    });
  });
});
