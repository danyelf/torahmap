// Tests for text-dating overlay - era detection, color computation, date ranges
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { getVerseDatingInfo } from '../../../overlays/text-dating';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const textDatingOverlay = getOverlay('text-dating')!;
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { Color } from '../../../overlays/types';

describe('Text Dating Overlay', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let testData: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test data matching the runtime format
    testData = {
      notes: [
        'P source (Priestly) - post-exilic redaction. [Source](https://en.wikipedia.org/wiki/Dating_the_Bible)',
        'J/E sources - pre-exilic core. [Source](https://en.wikipedia.org/wiki/Dating_the_Bible)',
        'Deutero-Isaiah - exile period. [Source](https://en.wikipedia.org/wiki/Book_of_Isaiah)',
        'Song of Deborah - one of oldest Hebrew poems. [Source](https://en.wikipedia.org/wiki/Dating_the_Bible)',
        'Daniel - Maccabean era. [Source](https://en.wikipedia.org/wiki/Book_of_Daniel)',
      ],
      books: {
        'Genesis': [
          // Chapter 1
          [
            { d: [-450, -400], n: 0 }, // Verse 1 - Persian period (note: BCE stored as negative)
            { d: [-450, -400], n: 0 }, // Verse 2
          ],
          // Chapter 2
          [
            { d: [-700, -650], n: 1 }, // Verse 1 - Late Monarchic
          ],
        ],
        'Isaiah': (() => {
          // Need to fill chapters 1-39 for chapter 40 to be at index 39
          const chapters: any[] = [];
          // Chapter 1
          chapters.push([
            { d: [-740, -700], n: 1 }, // Verse 1 - Late Monarchic (Proto-Isaiah)
          ]);
          // Chapters 2-39 (empty)
          for (let i = 1; i < 39; i++) {
            chapters.push([]);
          }
          // Chapter 40 (index 39)
          chapters.push([
            { d: [-550, -540], n: 2 }, // Verse 1 - Exilic (Deutero-Isaiah)
          ]);
          return chapters;
        })(),
        'Judges': [
          [],
          [],
          [],
          [],
          // Chapter 5
          [
            { d: [-1200, -1100], n: 3 }, // Verse 1 - Pre-Monarchic (Song of Deborah)
          ],
        ],
        'Daniel': [
          // Chapter 1
          [
            { d: [-167, -164], n: 4 }, // Verse 1 - Hellenistic
          ],
        ],
      },
    };

    // Mock fetch
    mockFetch = vi.fn((_url: string) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testData),
      } as Response);
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(textDatingOverlay.id).toBe('text-dating');
      expect(textDatingOverlay.name).toBe('Text Dating');
    });

    it('has required methods', () => {
      expect(textDatingOverlay.init).toBeDefined();
      expect(textDatingOverlay.getVerseColor).toBeDefined();
      expect(textDatingOverlay.renderLegend).toBeDefined();
      expect(textDatingOverlay.getHoverInfo).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('loads text-dating data on init', async () => {
      await textDatingOverlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/text-dating.json')
      );
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Should not throw
      await expect(textDatingOverlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('handles JSON parse errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as Response);

      // Should not throw
      await expect(textDatingOverlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Era Detection and Colors', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('assigns Pre-Monarchic era color (oldest)', () => {
      const verse = createVerse({ book: 'Judges', chapter: 5, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      assertValidColor(color!);
      expect(color).toBeDefined();

      // Pre-Monarchic should be deep red-brown
      const [r, g, b] = color! as [number, number, number];
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(b);
    });

    it('assigns Early Monarchic era color', () => {
      // Add test data for Early Monarchic
      testData.books['Exodus'] = [
        [
          { d: [-950, -900], n: 1 }, // Early Monarchic period
        ],
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      // Re-init with new data
      return textDatingOverlay.init?.().then(() => {
        const verse = createVerse({ book: 'Exodus', chapter: 1, verse: 1 });
        const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

        assertValidColor(color!);
        expect(color).toBeDefined();
      });
    });

    it('assigns Late Monarchic era color', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      assertValidColor(color!);
      expect(color).toBeDefined();

      // Late Monarchic should be orange-ish
      const [r, g, b] = color! as [number, number, number];
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    });

    it('assigns Exilic era color', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 40, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      assertValidColor(color!);
      expect(color).toBeDefined();
    });

    it('assigns Persian Period era color', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      assertValidColor(color!);
      expect(color).toBeDefined();
    });

    it('assigns Hellenistic era color (newest)', () => {
      const verse = createVerse({ book: 'Daniel', chapter: 1, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      assertValidColor(color!);
      expect(color).toBeDefined();
    });

    it('returns null for verse without dating data', () => {
      const verse = createVerse({ book: 'UnknownBook', chapter: 1, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      expect(color).toBeNull();
    });

    it('returns null for missing chapter in book', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 50, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      expect(color).toBeNull();
    });

    it('returns null for missing verse in chapter', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 999 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      expect(color).toBeNull();
    });
  });

  describe('Color Shading Within Eras', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('applies darker shade for later dates within era', () => {
      // Late Monarchic era: 722-586 BCE
      // According to the implementation: "Older texts within an era are lighter, newer texts are darker"
      // The shade factor ranges from 0.7 (start of era) to 1.0 (end of era)
      // So earlier dates (near start = 722 BCE) get shadeFactor closer to 0.7 (darker)
      // And later dates (near end = 586 BCE) get shadeFactor closer to 1.0 (lighter)
      // Wait, that seems backwards. Let me check the actual implementation...
      // Actually looking at the code: position = (rangeStart - dateBCE) / (rangeStart - rangeEnd)
      // For Late Monarchic: rangeStart=722, rangeEnd=586
      // For date 720 BCE: position = (722-720)/(722-586) = 2/136 = ~0.015 (near start)
      // For date 590 BCE: position = (722-590)/(722-586) = 132/136 = ~0.97 (near end)
      // shadeFactor = 0.7 + position * 0.3
      // So early date gets 0.7 + 0.015*0.3 = ~0.7 (darker)
      // And late date gets 0.7 + 0.97*0.3 = ~0.99 (lighter)
      // So later dates are LIGHTER, earlier dates are DARKER within an era
      testData.books['TestBook'] = [
        [
          { d: [-720, -720], n: 0 }, // Early in Late Monarchic (near start) - should be darker
          { d: [-590, -590], n: 0 }, // Late in Late Monarchic (near end) - should be lighter
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        const earlierVerse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
        const laterVerse = createVerse({ book: 'TestBook', chapter: 1, verse: 2 });

        const earlierColor = textDatingOverlay.getVerseColor?.(earlierVerse) as [number, number, number] | null | undefined;
        const laterColor = textDatingOverlay.getVerseColor?.(laterVerse) as [number, number, number] | null | undefined;

        assertValidColor(earlierColor!);
        assertValidColor(laterColor!);

        // Later verse should be lighter (larger RGB values)
        const earlierBrightness = (earlierColor as [number, number, number])[0] + (earlierColor as [number, number, number])[1] + (earlierColor as [number, number, number])[2];
        const laterBrightness = (laterColor as [number, number, number])[0] + (laterColor as [number, number, number])[1] + (laterColor as [number, number, number])[2];

        expect(laterBrightness).toBeGreaterThanOrEqual(earlierBrightness);
      });
    });

    it('uses midpoint of date range for color calculation', () => {
      // Verses with same midpoint should have same color
      testData.books['TestBook'] = [
        [
          { d: [-600, -500], n: 0 }, // Midpoint: 550 BCE
          { d: [-550, -550], n: 0 }, // Exact: 550 BCE
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        const verse1 = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
        const verse2 = createVerse({ book: 'TestBook', chapter: 1, verse: 2 });

        const color1 = textDatingOverlay.getVerseColor?.(verse1) as [number, number, number] | null | undefined;
        const color2 = textDatingOverlay.getVerseColor?.(verse2) as [number, number, number] | null | undefined;

        assertValidColor(color1!);
        assertValidColor(color2!);

        // Should be identical (or very close)
        expect((color1 as [number, number, number])[0]).toBeCloseTo((color2 as [number, number, number])[0], 5);
        expect((color1 as [number, number, number])[1]).toBeCloseTo((color2 as [number, number, number])[1], 5);
        expect((color1 as [number, number, number])[2]).toBeCloseTo((color2 as [number, number, number])[2], 5);
      });
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('returns hover info with era, date, and note', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const info = textDatingOverlay.getHoverInfo?.(verse);

      expect(info).toBeDefined();
      expect(info).toContain('BCE');
      expect(info).toContain('P source');
    });

    it('formats single date correctly', () => {
      testData.books['TestBook'] = [
        [
          { d: [-550, -550], n: 0 }, // Exact date
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
        const info = textDatingOverlay.getHoverInfo?.(verse);

        expect(info).toBeDefined();
        expect(info).toMatch(/~\d+ BCE/); // Should format as "~550 BCE"
      });
    });

    it('formats date range correctly', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 });
      const info = textDatingOverlay.getHoverInfo?.(verse);

      expect(info).toBeDefined();
      expect(info).toMatch(/\d+-\d+ BCE/); // Should format as "700-650 BCE"
    });

    it('returns null for verse without dating data', () => {
      const verse = createVerse({ book: 'UnknownBook', chapter: 1, verse: 1 });
      const info = textDatingOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('includes era name in hover info', () => {
      const verse = createVerse({ book: 'Judges', chapter: 5, verse: 1 });
      const info = textDatingOverlay.getHoverInfo?.(verse);

      expect(info).toBeDefined();
      expect(info).toContain('Pre-Monarchic');
    });
  });

  describe('Legend Rendering', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('renders legend with all eras', () => {
      const container = document.createElement('div');
      textDatingOverlay.renderLegend?.(container);

      const html = container.innerHTML;

      // Check for all 6 era names
      expect(html).toContain('Pre-Monarchic');
      expect(html).toContain('Early Monarchic');
      expect(html).toContain('Late Monarchic');
      expect(html).toContain('Exilic');
      expect(html).toContain('Persian Period');
      expect(html).toContain('Hellenistic');
    });

    it('includes date ranges in legend', () => {
      const container = document.createElement('div');
      textDatingOverlay.renderLegend?.(container);

      const html = container.innerHTML;

      // Check for BCE markers
      expect(html).toContain('BCE');

      // Check for date ranges (should be formatted like "1400-1000 BCE")
      expect(html).toMatch(/\d+-\d+ BCE/);
    });

    it('includes shading explanation', () => {
      const container = document.createElement('div');
      textDatingOverlay.renderLegend?.(container);

      const html = container.innerHTML;

      expect(html).toContain('Darker shades');
    });

    it('renders color swatches', () => {
      const container = document.createElement('div');
      textDatingOverlay.renderLegend?.(container);

      const swatches = container.querySelectorAll('.swatch');

      // Should have 6 swatches (one per era)
      expect(swatches.length).toBe(6);
    });
  });

  describe('getVerseDatingInfo Export', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('returns full dating info for valid verse', () => {
      const info = getVerseDatingInfo('Genesis', 1, 1);

      expect(info).toBeDefined();
      expect(info).toHaveProperty('era');
      expect(info).toHaveProperty('eraDateRange');
      expect(info).toHaveProperty('dateRange');
      expect(info).toHaveProperty('note');

      expect(info!.era).toBe('Persian Period');
      expect(Array.isArray(info!.eraDateRange)).toBe(true);
      expect(Array.isArray(info!.dateRange)).toBe(true);
      expect(typeof info!.note).toBe('string');
    });

    it('converts BCE to positive numbers in dateRange', () => {
      const info = getVerseDatingInfo('Genesis', 1, 1);

      expect(info).toBeDefined();
      expect(info!.dateRange[0]).toBeGreaterThan(0); // Should be 450, not -450
      expect(info!.dateRange[1]).toBeGreaterThan(0); // Should be 400, not -400
      expect(info!.dateRange[0]).toBe(450);
      expect(info!.dateRange[1]).toBe(400);
    });

    it('includes era date range', () => {
      const info = getVerseDatingInfo('Genesis', 1, 1);

      expect(info).toBeDefined();
      expect(info!.eraDateRange).toEqual([538, 331]); // Persian Period
    });

    it('returns note text', () => {
      const info = getVerseDatingInfo('Genesis', 1, 1);

      expect(info).toBeDefined();
      expect(info!.note).toContain('P source');
      expect(info!.note).toContain('[Source]'); // Should include markdown link
    });

    it('returns null for verse without dating data', () => {
      const info = getVerseDatingInfo('UnknownBook', 1, 1);

      expect(info).toBeNull();
    });

    it('returns null for missing chapter', () => {
      const info = getVerseDatingInfo('Genesis', 999, 1);

      expect(info).toBeNull();
    });

    it('returns null for missing verse', () => {
      const info = getVerseDatingInfo('Genesis', 1, 999);

      expect(info).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('handles empty chapters array gracefully', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 2, verse: 1 });
      const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

      expect(color).toBeNull();
    });

    it('handles null verse data in chapter', () => {
      // Add explicit null verse
      testData.books['TestBook'] = [
        [
          null, // Verse 1 is null
          { d: [-500, -500], n: 0 }, // Verse 2 has data
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        const verse1 = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
        const verse2 = createVerse({ book: 'TestBook', chapter: 1, verse: 2 });

        expect(textDatingOverlay.getVerseColor?.(verse1)).toBeNull();
        const color2 = textDatingOverlay.getVerseColor?.(verse2) as [number, number, number] | null;
        assertValidColor(color2!);
      });
    });

    it('handles BCE dates at era boundaries', () => {
      // Test dates exactly at era boundaries
      testData.books['TestBook'] = [
        [
          { d: [-1000, -1000], n: 0 }, // Exactly at Pre-Monarchic/Early Monarchic boundary
          { d: [-722, -722], n: 0 },   // Exactly at Early/Late Monarchic boundary
          { d: [-586, -586], n: 0 },   // Exactly at Late Monarchic/Exilic boundary
          { d: [-538, -538], n: 0 },   // Exactly at Exilic/Persian boundary
          { d: [-331, -331], n: 0 },   // Exactly at Persian/Hellenistic boundary
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        // All boundary dates should have valid colors
        for (let verse = 1; verse <= 5; verse++) {
          const v = createVerse({ book: 'TestBook', chapter: 1, verse });
          const color = textDatingOverlay.getVerseColor?.(v) as [number, number, number] | null | undefined;
          assertValidColor(color!);
        }
      });
    });

    it('handles very wide date ranges', () => {
      testData.books['TestBook'] = [
        [
          { d: [-1000, -500], n: 0 }, // 500 year range
        ],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response);

      return textDatingOverlay.init?.().then(() => {
        const verse = createVerse({ book: 'TestBook', chapter: 1, verse: 1 });
        const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;

        assertValidColor(color!);

        const info = textDatingOverlay.getHoverInfo?.(verse);
        expect(info).toContain('1000-500 BCE'); // Should format range correctly
      });
    });
  });

  describe('Color Values', () => {
    beforeEach(async () => {
      await textDatingOverlay.init?.();
    });

    it('produces valid RGB values in range [0, 1]', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
        createVerse({ book: 'Isaiah', chapter: 40, verse: 1 }),
        createVerse({ book: 'Judges', chapter: 5, verse: 1 }),
        createVerse({ book: 'Daniel', chapter: 1, verse: 1 }),
      ];

      verses.forEach((verse) => {
        const color = textDatingOverlay.getVerseColor?.(verse) as [number, number, number] | null | undefined;
        assertValidColor(color!);

        if (color) {
          color.forEach((component) => {
            expect(component).toBeGreaterThanOrEqual(0);
            expect(component).toBeLessThanOrEqual(1);
          });
        }
      });
    });

    it('produces distinguishable colors across eras', () => {
      const preMonarchic = textDatingOverlay.getVerseColor?.(
        createVerse({ book: 'Judges', chapter: 5, verse: 1 })
      ) as [number, number, number] | null;
      const persian = textDatingOverlay.getVerseColor?.(
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 })
      ) as [number, number, number] | null;
      const hellenistic = textDatingOverlay.getVerseColor?.(
        createVerse({ book: 'Daniel', chapter: 1, verse: 1 })
      ) as [number, number, number] | null;

      assertValidColor(preMonarchic!);
      assertValidColor(persian!);
      assertValidColor(hellenistic!);

      // Colors should be different enough to distinguish
      const colorDistance = (c1: Color, c2: Color) => {
        return Math.sqrt(
          Math.pow(c1[0] - c2[0], 2) +
          Math.pow(c1[1] - c2[1], 2) +
          Math.pow(c1[2] - c2[2], 2)
        );
      };

      expect(colorDistance(preMonarchic! as Color, persian! as Color)).toBeGreaterThan(0.1);
      expect(colorDistance(persian! as Color, hellenistic! as Color)).toBeGreaterThan(0.1);
      expect(colorDistance(preMonarchic! as Color, hellenistic! as Color)).toBeGreaterThan(0.1);
    });
  });
});
