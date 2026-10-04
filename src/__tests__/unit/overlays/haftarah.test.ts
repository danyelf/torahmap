import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { haftarahOverlay as overlay } from '../../../overlays/haftarah';
import { hostOverlay } from '../../helpers/overlayHost';
import { createVerse, SAMPLE_HAFTARAH_MAPPINGS, SAMPLE_STRUCTURE } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import { overlayColorsFor } from '../../../itemColoring';
import type { Color } from '../../../overlays/types';
import type { HaftarahData } from '../../../overlays/haftarah/readings';
import { rgbToHsl } from '../../../utils/color';
import { HOVER_LINGER_MS } from '../../../utils/hover';
import { DIMMED_GREY } from '../../../constants';

const DATA: HaftarahData = { mappings: SAMPLE_HAFTARAH_MAPPINGS, structure: SAMPLE_STRUCTURE };
const haftarahOverlay = hostOverlay(overlay, DATA);

const sum = (c: Color) => c[0] + c[1] + c[2];

describe('Haftarah Overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    haftarahOverlay.setData(DATA);
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
    beforeEach(() => {
      haftarahOverlay.restore({ custom: 'ashkenazi' });
    });

    it('declares the keys it owns', () => {
      expect(haftarahOverlay.overlay.urlParams).toEqual([
        { key: 'custom', kind: 'token', allowed: ['ashkenazi', 'sephardi'], default: 'ashkenazi' },
        { key: 'reading', kind: 'token' },
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

  describe('data', () => {
    it('draws the custom picker, and the key once the readings arrive', () => {
      const container = document.createElement('div');
      const settings = { custom: 'ashkenazi' as const, preview: null, reading: null };
      overlay.renderControls!(container, settings, () => {}, null);
      expect(container.querySelector('#custom-select')).not.toBeNull();
      expect(container.querySelector('.haftarah-key')).toBeNull();
      overlay.renderControls!(container, settings, () => {}, {
        mappings: SAMPLE_HAFTARAH_MAPPINGS,
        structure: SAMPLE_STRUCTURE,
      });
      expect(container.querySelector('.haftarah-key')).not.toBeNull();
    });

    it('draws no legend before the readings are in', () => {
      const legend = document.createElement('div');
      legend.innerHTML = 'stale';
      overlay.renderLegend!(legend, { custom: 'ashkenazi', preview: null, reading: null }, null);
      expect(legend.innerHTML).toBe('');
    });
  });

  describe('Torah Verses (Parshiot)', () => {
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
    it('counts the portions and the special occasions', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend(container);

      expect(container.textContent).toContain('2 Torah portions and 2 special occasions');
    });
  });

  describe('The key', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    const genesis = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
    const bereshitHaftarah = createVerse({ book: 'Isaiah', chapter: 42, verse: 5 });
    const noach = createVerse({ book: 'Genesis', chapter: 7, verse: 1 });
    const psalms = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });

    const BERESHIT = 'Bereshit';
    const ROSH_CHODESH = 'Shabbat Rosh Chodesh';

    function keyRows(container: HTMLElement) {
      return [...container.querySelectorAll('.haftarah-key-row')].map((row) => ({
        label: row.querySelector('.haftarah-key-label')!.textContent,
        readings: [...row.querySelectorAll<HTMLElement>('[data-reading]')].map((el) => ({
          name: el.title,
          reading: el.dataset.reading,
        })),
      }));
    }

    function swatch(container: HTMLElement, reading: string): HTMLElement {
      return container.querySelector<HTMLElement>(`[data-reading="${reading}"]`)!;
    }

    const preview = (reading: string | null) =>
      haftarahOverlay.change((current) => ({ ...current, preview: reading }));

    /** Hand over the sample data with Rosh Chodesh's haftarah under `custom` replaced by `ranges`. */
    function loadRoshChodesh(custom: 'ashkenazi' | 'sephardi', ranges: unknown[]) {
      const changed = structuredClone(SAMPLE_HAFTARAH_MAPPINGS);
      changed.specialOccasions[0].haftarah[custom] = ranges as never;
      haftarahOverlay.setData({ mappings: changed, structure: SAMPLE_STRUCTURE });
    }

    it('keys each book by its portions, and occasions by category', () => {
      const container = haftarahOverlay.renderControls();

      expect(keyRows(container)).toEqual([
        {
          label: 'Genesis',
          readings: [
            { name: 'Bereshit', reading: 'Bereshit' },
            { name: 'Noach', reading: 'Noach' },
          ],
        },
        {
          label: 'High Holidays',
          readings: [{ name: 'Rosh Hashanah Day 1', reading: 'Rosh Hashanah Day 1' }],
        },
        {
          label: 'Rosh Chodesh',
          readings: [{ name: 'Shabbat Rosh Chodesh', reading: 'Shabbat Rosh Chodesh' }],
        },
      ]);
    });

    it('is built once, so a redraw keeps the swatch under the pointer', () => {
      const container = haftarahOverlay.renderControls();
      const before = swatch(container, BERESHIT);
      haftarahOverlay.change((current) => ({ ...current, custom: 'sephardi' }));

      expect(swatch(container, BERESHIT)).toBe(before);
    });

    it('previews a reading while the pointer is over it, and not once it has left', () => {
      const container = haftarahOverlay.renderControls();
      swatch(container, BERESHIT).dispatchEvent(new Event('pointerover', { bubbles: true }));
      expect(haftarahOverlay.settings.preview).toBe(BERESHIT);

      container.querySelector('.haftarah-key')!.dispatchEvent(new Event('pointerleave'));
      vi.advanceTimersByTime(HOVER_LINGER_MS);
      expect(haftarahOverlay.settings.preview).toBeNull();
    });

    it('keeps a preview out of the link', () => {
      preview(BERESHIT);
      expect(haftarahOverlay.toUrl()).toEqual({});
    });

    it('lights a previewed reading, darkens the others, and greys the rest', () => {
      const cold = [genesis, bereshitHaftarah, noach].map(
        (v) => haftarahOverlay.getVerseColor(v) as Color,
      );
      preview(BERESHIT);
      const [hotTorah, hotHaftarah, darkNoach] = [genesis, bereshitHaftarah, noach].map(
        (v) => haftarahOverlay.getVerseColor(v) as Color,
      );

      expect(sum(hotTorah)).toBeGreaterThan(sum(cold[0]));
      expect(sum(hotHaftarah)).toBeGreaterThan(sum(cold[1]));
      expect(sum(darkNoach)).toBeLessThan(sum(cold[2]));
      expect(haftarahOverlay.getVerseColor(psalms)).toEqual(DIMMED_GREY);
    });

    it('lights every reading that shares a verse with the previewed one', () => {
      // Overlaps Bereshit's Ashkenazi haftarah, 42:5-21.
      loadRoshChodesh('ashkenazi', [
        { book: 'Isaiah', start: { chapter: 42, verse: 18 }, end: { chapter: 42, verse: 25 } },
      ]);
      const cold = haftarahOverlay.getVerseColor(genesis) as Color;
      preview(ROSH_CHODESH);

      expect(sum(haftarahOverlay.getVerseColor(genesis) as Color)).toBeGreaterThan(sum(cold));
      expect(sum(haftarahOverlay.getVerseColor(noach) as Color)).toBeLessThan(
        sum(
          haftarahOverlay.overlay.getVerseColor(
            noach,
            haftarahOverlay.fromUrl({}),
            haftarahOverlay.data,
          ) as Color,
        ),
      );
    });

    it("finds shared verses in the custom's own haftarot", () => {
      // Noach's Sephardi haftarah; under Ashkenazi, Rosh Chodesh shares nothing.
      loadRoshChodesh('sephardi', [
        { book: 'Isaiah', start: { chapter: 54, verse: 1 }, end: { chapter: 54, verse: 10 } },
      ]);
      const noachLit = () => {
        const cold = haftarahOverlay.overlay.getVerseColor(
          noach,
          {
            ...haftarahOverlay.settings,
            preview: null,
          },
          haftarahOverlay.data,
        ) as Color;
        return sum(haftarahOverlay.getVerseColor(noach) as Color) > sum(cold);
      };

      preview(ROSH_CHODESH);
      expect(noachLit()).toBe(false);
      haftarahOverlay.change((current) => ({ ...current, custom: 'sephardi' }));
      expect(noachLit()).toBe(true);
    });

    it('leaves the map hover out of the colours while a reading is previewed', () => {
      preview(BERESHIT);
      expect(haftarahOverlay.hoverChangesColors(null, noach)).toBe(false);
    });
  });

  describe('A reading named in a story stop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    const genesis = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
    const noach = createVerse({ book: 'Genesis', chapter: 7, verse: 1 });
    const psalms = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
    const brightness = (v: typeof genesis) => sum(haftarahOverlay.getVerseColor(v) as Color);
    const brightnessUnder = (v: typeof genesis, hovered: typeof genesis | null) =>
      sum(
        haftarahOverlay.overlay.colorsFor!(
          [v],
          haftarahOverlay.settings,
          hovered,
          DATA,
        )[0] as Color,
      );

    it('reads a name with spaces and punctuation, and never writes it into a link', () => {
      haftarahOverlay.restore({ reading: 'Rosh Hashanah Day 1' });
      expect(haftarahOverlay.settings.reading).toBe('Rosh Hashanah Day 1');
      expect(haftarahOverlay.toUrl()).toEqual({});

      haftarahOverlay.restore({ reading: "Tisha B'Av, Morning" });
      expect(haftarahOverlay.settings.reading).toBe("Tisha B'Av, Morning");
    });

    it('names no reading when the link names none', () => {
      expect(haftarahOverlay.settings.reading).toBeNull();
      expect(haftarahOverlay.toUrl()).toEqual({});
    });

    it('lights the reading exactly as hovering it in the key does', () => {
      haftarahOverlay.change((current) => ({ ...current, preview: 'Bereshit' }));
      const previewed = [genesis, noach, psalms].map((v) => haftarahOverlay.getVerseColor(v));

      haftarahOverlay.restore({ reading: 'Bereshit' });

      expect([genesis, noach, psalms].map((v) => haftarahOverlay.getVerseColor(v))).toEqual(
        previewed,
      );
    });

    it('lights nothing for a name no reading has', () => {
      const cold = brightness(genesis);
      haftarahOverlay.restore({ reading: 'Nonesuch' });
      expect(brightness(genesis)).toBe(cold);
      expect(haftarahOverlay.getVerseColor(psalms)).toBeNull();
    });

    it('gives way to a reading hovered in the key, and returns when it is left', () => {
      haftarahOverlay.restore({ reading: 'Bereshit' });
      const container = haftarahOverlay.renderControls();
      const noachSwatch = container.querySelector<HTMLElement>('[data-reading="Noach"]')!;

      noachSwatch.dispatchEvent(new Event('pointerover', { bubbles: true }));
      expect(brightness(noach)).toBeGreaterThan(brightness(genesis));

      container.querySelector('.haftarah-key')!.dispatchEvent(new Event('pointerleave'));
      vi.advanceTimersByTime(HOVER_LINGER_MS);
      expect(haftarahOverlay.settings.reading).toBe('Bereshit');
      expect(brightness(genesis)).toBeGreaterThan(brightness(noach));
    });

    it('gives way to a hovered verse of another reading on the map', () => {
      haftarahOverlay.restore({ reading: 'Bereshit' });
      expect(brightnessUnder(noach, noach)).toBeGreaterThan(brightnessUnder(genesis, noach));
    });

    it('stays lit while the map hover is on a verse outside every reading', () => {
      haftarahOverlay.restore({ reading: 'Bereshit' });
      expect(brightnessUnder(genesis, psalms)).toBe(brightnessUnder(genesis, null));
      expect(brightnessUnder(genesis, psalms)).toBeGreaterThan(brightnessUnder(noach, psalms));
    });
  });

  describe('Multi-Item Verses', () => {
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
    it('answers for a custom it is handed without changing its own', () => {
      haftarahOverlay.restore({ custom: 'sephardi' });

      const items = [createVerse({ book: 'Genesis', chapter: 1, verse: 1 })];
      haftarahOverlay.overlay.colorsFor!(
        items,
        haftarahOverlay.fromUrl({ custom: 'ashkenazi' }),
        null,
        DATA,
      );

      expect(haftarahOverlay.toUrl()).toEqual({ custom: 'sephardi' });
    });

    it('brightens the hovered pairing, darkens other readings to a tint, and greys the rest', () => {
      const torah = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const itsHaftarah = createVerse({ book: 'Isaiah', chapter: 42, verse: 5 });
      const otherParsha = createVerse({ book: 'Genesis', chapter: 7, verse: 1 });
      const noReading = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const items = [torah, itsHaftarah, otherParsha, noReading];
      const settings = haftarahOverlay.fromUrl({ custom: 'ashkenazi' });

      const cold = haftarahOverlay.overlay.colorsFor!(
        items,
        settings,
        null,
        DATA,
      ) as (Color | null)[];
      const hot = haftarahOverlay.overlay.colorsFor!(items, settings, torah, DATA) as Color[];

      for (const i of [0, 1]) {
        hot[i].forEach((channel, c) => expect(channel).toBeGreaterThanOrEqual(cold[i]![c]));
        expect(sum(hot[i])).toBeGreaterThan(sum(cold[i]!));
      }

      // Noach keeps its hue, darkened.
      expect(sum(hot[2])).toBeLessThan(sum(cold[2]!));
      expect(Math.round(rgbToHsl(hot[2]).h)).toBe(Math.round(rgbToHsl(cold[2]!).h));

      expect(cold[3]).toBeNull();
      const [r, g, b] = hot[3];
      expect(r).toBe(g);
      expect(g).toBe(b);
      expect(r).toBeLessThan(0.25);
    });

    it('is what the settled map shows for a hovered verse', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Isaiah', chapter: 42, verse: 5 }),
        createVerse({ book: 'Genesis', chapter: 7, verse: 1 }),
      ];
      const settings = haftarahOverlay.settings;

      const settled = overlayColorsFor(haftarahOverlay.overlay, verses, settings, verses[0], DATA);

      expect(settled).toEqual(
        haftarahOverlay.overlay.colorsFor!(verses, settings, verses[0], DATA),
      );
      expect(settled).not.toEqual(
        overlayColorsFor(haftarahOverlay.overlay, verses, settings, null, DATA),
      );
    });

    it('treats a hovered verse outside every reading the same as no hover', () => {
      const items = [createVerse({ book: 'Genesis', chapter: 1, verse: 1 })];
      const outsideEveryReading = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const settings = haftarahOverlay.fromUrl({ custom: 'ashkenazi' });

      const noHover = haftarahOverlay.overlay.colorsFor!(items, settings, null, DATA);
      const irrelevantHover = haftarahOverlay.overlay.colorsFor!(
        items,
        settings,
        outsideEveryReading,
        DATA,
      );

      expect(irrelevantHover).toEqual(noHover);
    });
  });
});
