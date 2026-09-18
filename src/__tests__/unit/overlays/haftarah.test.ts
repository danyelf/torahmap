import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { hostOverlay } from '../../helpers/overlayHost';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const haftarahOverlay = hostOverlay(getOverlay('haftarah')!);
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import { mockFetch as installMockFetch } from '../../helpers/mocks';
import { overlayColorsFor } from '../../../itemColoring';
import type { Color } from '../../../overlays/types';

const sum = (c: Color) => c[0] + c[1] + c[2];

// Sample data matching the real structure
const SAMPLE_HAFTARAH_DATA = {
  parshiot: [
    {
      name: 'Bereshit',
      hebrewName: 'בראשית',
      torah: {
        book: 'Genesis',
        start: { chapter: 1, verse: 1 },
        end: { chapter: 6, verse: 8 },
      },
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 42, verse: 5 },
            end: { chapter: 42, verse: 21 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 42, verse: 5 },
            end: { chapter: 43, verse: 10 },
          },
        ],
      },
    },
    {
      name: 'Noach',
      hebrewName: 'נח',
      torah: {
        book: 'Genesis',
        start: { chapter: 6, verse: 9 },
        end: { chapter: 11, verse: 32 },
      },
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 54, verse: 1 },
            end: { chapter: 55, verse: 5 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 54, verse: 1 },
            end: { chapter: 54, verse: 10 },
          },
        ],
      },
    },
  ],
  specialOccasions: [
    {
      name: 'Shabbat Rosh Chodesh',
      hebrewName: 'שבת ראש חודש',
      category: 'rosh-chodesh',
      haftarah: {
        ashkenazi: [
          {
            book: 'Isaiah',
            start: { chapter: 66, verse: 1 },
            end: { chapter: 66, verse: 24 },
          },
        ],
        sephardi: [
          {
            book: 'Isaiah',
            start: { chapter: 66, verse: 1 },
            end: { chapter: 66, verse: 24 },
          },
        ],
      },
    },
    {
      name: 'Rosh Hashanah Day 1',
      hebrewName: 'ראש השנה יום א׳',
      category: 'high-holidays',
      haftarah: {
        ashkenazi: [
          {
            book: 'I Samuel',
            start: { chapter: 1, verse: 1 },
            end: { chapter: 2, verse: 10 },
          },
        ],
        sephardi: [
          {
            book: 'I Samuel',
            start: { chapter: 1, verse: 1 },
            end: { chapter: 2, verse: 10 },
          },
        ],
      },
    },
  ],
};

const SAMPLE_STRUCTURE = {
  books: [
    {
      name: 'Genesis',
      hebrewName: 'בראשית',
      section: 'torah',
      chapters: [
        31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20,
        67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34,
        31, 22, 33, 26,
      ],
    },
    {
      name: 'Isaiah',
      hebrewName: 'ישעיהו',
      section: 'neviim',
      chapters: [
        31, 22, 26, 6, 30, 13, 25, 23, 20, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23,
        12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15,
        22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24,
      ],
    },
    {
      name: 'I Samuel',
      hebrewName: 'שמואל א',
      section: 'neviim',
      chapters: [
        28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 43, 15, 23, 28,
        23, 44, 25, 12, 25, 11, 31, 13,
      ],
    },
  ],
};

describe('Haftarah Overlay', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch = installMockFetch({
      '/data/overlays/haftarah/mappings.json': SAMPLE_HAFTARAH_DATA,
      '/data/tanakh-structure.json': SAMPLE_STRUCTURE,
    });

    // The custom is held by the same host across tests, so start each one on
    // the default the way switching to the overlay fresh would.
    haftarahOverlay.restore({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    haftarahOverlay.destroy();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(haftarahOverlay.overlay.id).toBe('haftarah');
      expect(haftarahOverlay.overlay.name).toBe('Haftarah');
    });
  });

  describe('Custom setting in the URL', () => {
    // The URL carries the Ashkenazi/Sephardi choice, so a reload keeps it.
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
      haftarahOverlay.restore({ custom: 'ashkenazi' });
    });

    it('declares the custom key it owns', () => {
      expect(haftarahOverlay.overlay.urlParams).toEqual([
        { key: 'custom', kind: 'token', allowed: ['ashkenazi', 'sephardi'], default: 'ashkenazi' },
      ]);
    });

    it('reports nothing while on the default (Ashkenazi)', () => {
      expect(haftarahOverlay.toUrl()).toEqual({});
    });

    it('reports the Sephardi custom once it is chosen', () => {
      const container = haftarahOverlay.renderControls();
      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'sephardi';
      select.dispatchEvent(new Event('change'));

      expect(haftarahOverlay.toUrl()).toEqual({ custom: 'sephardi' });
    });

    it('restores the Sephardi custom and reports it back', () => {
      haftarahOverlay.restore({ custom: 'sephardi' });
      expect(haftarahOverlay.toUrl()).toEqual({ custom: 'sephardi' });
    });

    it('switches back to Ashkenazi when asked to', () => {
      haftarahOverlay.restore({ custom: 'sephardi' });
      haftarahOverlay.restore({ custom: 'ashkenazi' });
      expect(haftarahOverlay.toUrl()).toEqual({});
    });

    it('falls back to the default when the value is not recognised', () => {
      haftarahOverlay.restore({ custom: 'sephardi' });
      haftarahOverlay.restore({ custom: 'yemenite' });
      expect(haftarahOverlay.toUrl()).toEqual({});
    });

    it('draws the dropdown from the custom a link restored', () => {
      haftarahOverlay.restore({ custom: 'sephardi' });

      const container = haftarahOverlay.renderControls();

      expect(container.querySelector('select')?.value).toBe('sephardi');
    });

    it('does not announce a restore as a change, leaving that to the restorer', () => {
      // Restoring is not a change the reader made. The caller that read the
      // link repaints; announcing it here would make the restore turn around
      // and write the settings straight back into the URL.
      const listener = vi.fn();
      haftarahOverlay.onChange(listener);

      haftarahOverlay.restore({ custom: 'sephardi' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Initialization', () => {
    it('loads haftarah mappings data on init', async () => {
      await haftarahOverlay.overlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/overlays/haftarah/mappings.json'),
      );
    });

    it('loads tanakh structure data on init', async () => {
      await haftarahOverlay.overlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('data/tanakh-structure.json'));
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(haftarahOverlay.overlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Torah Verses (Parshiot)', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns color for Torah verses in a parsha', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns consistent color for same parsha', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const verse2 = createVerse({ book: 'Genesis', chapter: 5, verse: 10 });

      const color1 = haftarahOverlay.getVerseColor(verse1);
      const color2 = haftarahOverlay.getVerseColor(verse2);

      expect(color1).toEqual(color2);
    });

    it('returns different colors for different parshiot', () => {
      const bereshitVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const noachVerse = createVerse({ book: 'Genesis', chapter: 7, verse: 1 });

      const color1 = haftarahOverlay.getVerseColor(bereshitVerse);
      const color2 = haftarahOverlay.getVerseColor(noachVerse);

      expect(color1).not.toEqual(color2);
    });
  });

  describe('Haftarah Verses (Parshiot)', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns color for haftarah verses', () => {
      // Isaiah 42:5-21 is haftarah for Bereshit (Ashkenazi)
      const verse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('haftarah has same color as its Torah portion', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const haftarahVerse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });

      const torahColor = haftarahOverlay.getVerseColor(torahVerse) as
        [number, number, number] | null;
      const haftarahColor = haftarahOverlay.getVerseColor(haftarahVerse) as
        [number, number, number] | null;

      expect(torahColor).toEqual(haftarahColor);
    });
  });

  describe('Special Occasions', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns color for special occasion haftarah verses', () => {
      // Isaiah 66 is haftarah for Shabbat Rosh Chodesh
      const verse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns color for high holiday haftarah verses', () => {
      // I Samuel 1-2 is haftarah for Rosh Hashanah Day 1
      const verse = createVerse({ book: 'I Samuel', chapter: 1, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('special occasions have different colors than parshiot', () => {
      const parshaVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const occasionVerse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });

      const parshaColor = haftarahOverlay.getVerseColor(parshaVerse) as
        [number, number, number] | null;
      const occasionColor = haftarahOverlay.getVerseColor(occasionVerse) as
        [number, number, number] | null;

      expect(parshaColor).not.toEqual(occasionColor);
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns hover info for Torah verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const info = haftarahOverlay.getHoverInfo(verse);

      expect(info).toContain('Bereshit');
      expect(info).toContain('בראשית');
    });

    it('returns hover info for haftarah verses', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });
      const info = haftarahOverlay.getHoverInfo(verse);

      expect(info).toContain('Bereshit');
      expect(info).toContain('Haftarah');
    });

    it('returns hover info for special occasion haftarah', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });
      const info = haftarahOverlay.getHoverInfo(verse);

      expect(info).toContain('Shabbat Rosh Chodesh');
    });

    it('returns null for non-haftarah verses', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const info = haftarahOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('renders legend with parsha count', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Parshiot');
    });

    it('renders legend with special occasions count', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Special Occasions');
    });

    it('mentions holidays in legend', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('holidays');
    });
  });

  describe('Multi-Item Verses (Stipple)', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns color for haftarah verse (single item)', () => {
      // Isaiah 54:1-10 is Noach haftarah in our sample
      // This verse is only in Noach haftarah in our sample
      const verse = createVerse({ book: 'Isaiah', chapter: 54, verse: 5 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      // Should return a single color since there's no overlap in sample
      expect(color).not.toBeNull();

      // The return can be Color or Color[], so check both cases
      if (Array.isArray(color) && Array.isArray(color[0])) {
        // Array of colors - multi-item verse
        for (const c of color as unknown as [number, number, number][]) {
          assertValidColor(c);
        }
      } else {
        // Single color
        assertValidColor(color as [number, number, number]);
      }
    });
  });

  describe('Color Distribution', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('distributes colors across rainbow spectrum', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // First parsha
      const verse2 = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 }); // First special occasion

      const color1 = haftarahOverlay.getVerseColor(verse1) as [number, number, number];
      const color2 = haftarahOverlay.getVerseColor(verse2) as [number, number, number];

      expect(color1).not.toBeNull();
      expect(color2).not.toBeNull();

      // Colors should be different (different items get different hues)
      expect(color1).not.toEqual(color2);
    });

    it('colors are valid RGB values', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number];

      expect(color[0]).toBeGreaterThanOrEqual(0);
      expect(color[0]).toBeLessThanOrEqual(1);
      expect(color[1]).toBeGreaterThanOrEqual(0);
      expect(color[1]).toBeLessThanOrEqual(1);
      expect(color[2]).toBeGreaterThanOrEqual(0);
      expect(color[2]).toBeLessThanOrEqual(1);
    });
  });

  describe('Non-Relevant Verses', () => {
    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('returns null for non-Torah non-haftarah verses', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toBeNull();
    });

    it('returns null for book not in any reading', () => {
      const verse = createVerse({ book: 'Ruth', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).toBeNull();
    });
  });

  describe('which hover moves change the colours (hoverChangesColors)', () => {
    const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
    const psalmsVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
    const ruthVerse = createVerse({ book: 'Ruth', chapter: 1, verse: 1 });

    beforeEach(async () => {
      await haftarahOverlay.overlay.init?.();
    });

    it('is true from no hover onto a verse of a reading, and back', () => {
      expect(haftarahOverlay.hoverChangesColors(null, torahVerse)).toBe(true);
      expect(haftarahOverlay.hoverChangesColors(torahVerse, null)).toBe(true);
    });

    it('is true from a verse of a reading onto one outside every reading', () => {
      expect(haftarahOverlay.hoverChangesColors(torahVerse, psalmsVerse)).toBe(true);
    });

    it('is false between verses outside every reading, or off the map', () => {
      expect(haftarahOverlay.hoverChangesColors(psalmsVerse, ruthVerse)).toBe(false);
      expect(haftarahOverlay.hoverChangesColors(psalmsVerse, null)).toBe(false);
    });

    it('is false when the hovered verse stays the same', () => {
      expect(haftarahOverlay.hoverChangesColors(torahVerse, torahVerse)).toBe(false);
    });

    it('judges relevance against the settings it is handed, not a stale custom', () => {
      // A verse that is only a haftarah verse under Sephardi: Isaiah 43:5 is
      // read for Bereshit in the sample data under Sephardi, not Ashkenazi.
      const sephardiOnly = createVerse({ book: 'Isaiah', chapter: 43, verse: 5 });

      haftarahOverlay.restore({ custom: 'sephardi' });
      expect(haftarahOverlay.hoverChangesColors(null, sephardiOnly)).toBe(true);

      haftarahOverlay.restore({ custom: 'ashkenazi' });
      expect(haftarahOverlay.hoverChangesColors(null, sephardiOnly)).toBe(false);
    });
  });

  describe('colorsFor', () => {
    it('answers for a custom it is handed without changing its own', async () => {
      await haftarahOverlay.overlay.init?.();
      haftarahOverlay.restore({ custom: 'sephardi' });

      const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];
      haftarahOverlay.overlay.colorsFor!(
        items,
        haftarahOverlay.fromUrl({ custom: 'ashkenazi' }),
        null,
      );

      expect(haftarahOverlay.toUrl()).toEqual({ custom: 'sephardi' });
    });

    it('brightens the hovered pairing and desaturates the rest', async () => {
      await haftarahOverlay.overlay.init?.();
      const torah = { book: 'Genesis', chapter: 1, verse: 1 };
      const itsHaftarah = { book: 'Isaiah', chapter: 42, verse: 5 };
      const otherParsha = { book: 'Genesis', chapter: 7, verse: 1 };
      const items = [torah, itsHaftarah, otherParsha];
      const settings = haftarahOverlay.fromUrl({ custom: 'ashkenazi' });

      const cold = haftarahOverlay.overlay.colorsFor!(items, settings, null) as Color[];
      const hot = haftarahOverlay.overlay.colorsFor!(items, settings, torah) as Color[];

      for (const i of [0, 1]) {
        hot[i].forEach((channel, c) => expect(channel).toBeGreaterThanOrEqual(cold[i][c]));
        expect(sum(hot[i])).toBeGreaterThan(sum(cold[i]));
      }
      expect(hot[2]).not.toEqual(cold[2]);
    });

    it('is what the settled map shows for a hovered verse', async () => {
      await haftarahOverlay.overlay.init?.();
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Isaiah', chapter: 42, verse: 5 }),
        createVerse({ book: 'Genesis', chapter: 7, verse: 1 }),
      ];
      const settings = haftarahOverlay.settings;

      const settled = overlayColorsFor(haftarahOverlay.overlay, verses, settings, verses[0]);

      expect(settled).toEqual(haftarahOverlay.overlay.colorsFor!(verses, settings, verses[0]));
      expect(settled).not.toEqual(
        overlayColorsFor(haftarahOverlay.overlay, verses, settings, null),
      );
    });

    it('treats a hovered verse outside every reading the same as no hover', async () => {
      await haftarahOverlay.overlay.init?.();
      const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];
      const outsideEveryReading = { book: 'Psalms', chapter: 1, verse: 1 };
      const settings = haftarahOverlay.fromUrl({ custom: 'ashkenazi' });

      const noHover = haftarahOverlay.overlay.colorsFor!(items, settings, null);
      const irrelevantHover = haftarahOverlay.overlay.colorsFor!(
        items,
        settings,
        outsideEveryReading,
      );

      expect(irrelevantHover).toEqual(noHover);
    });
  });
});
