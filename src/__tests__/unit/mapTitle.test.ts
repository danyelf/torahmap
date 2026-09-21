import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMapTitle, updateMapTitlePosition, artworkSize } from '../../mapTitle';
import { createVerse } from '../helpers';

// A Torah row starting at x=1000 above a Prophets row reaching back to x=0:
// the empty corner is 0..1000 wide, so the title centres on x=500.
const VERSES = [
  createVerse({ book: 'Genesis', x: 1400, y: 0 }),
  createVerse({ book: 'Deuteronomy', x: 1000, y: 40 }),
  createVerse({ book: 'Isaiah', x: 600, y: 500 }),
  createVerse({ book: 'Malachi', x: 0, y: 500 }),
];
const isTorah = (book: string): boolean => book === 'Genesis' || book === 'Deuteronomy';
const TORAH_TOP_Y = 0;
const ZOOMS = [0.05, 0.2, 0.315, 0.63, 1, 2.5, 10];

const svgOf = (title: HTMLElement): SVGSVGElement => {
  const svg = title.querySelector('svg');
  if (!svg) throw new Error('no artwork');
  return svg;
};

describe('mapTitle', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('createMapTitle', () => {
    it('keeps the title out of the book-label container, which rewrites its children', () => {
      const title = createMapTitle(VERSES, container, isTorah);

      expect(title.id).toBe('map-title');
      expect(title.parentElement).toBe(container);
      expect(title.closest('#book-labels')).toBeNull();
    });

    it('carries the Hebrew name, the English name and the tagline', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const lines = [...svgOf(title).querySelectorAll('text')].map((t) => t.textContent);

      expect(lines).toEqual(['מפת התנ״ך', 'Torahmap', 'A visual concordance to the Hebrew Bible']);
    });

    it('centres on the gap between the map’s left edge and the Torah’s', () => {
      const title = createMapTitle(VERSES, container, isTorah);

      expect(parseFloat(svgOf(title).dataset.centreX!)).toBe(500);
    });

    it('sits above the Torah by a gap measured in map units', () => {
      const title = createMapTitle(VERSES, container, isTorah);

      expect(parseFloat(svgOf(title).dataset.topY!)).toBeLessThan(TORAH_TOP_Y);
    });

    it('survives an empty layout', () => {
      const title = createMapTitle([], container, isTorah);
      const svg = svgOf(title);

      expect(parseFloat(svg.dataset.centreX!)).toBe(0);
      expect(Number.isFinite(parseFloat(svg.dataset.topY!))).toBe(true);
    });
  });

  describe('it is painted on the map', () => {
    it('grows with the zoom and is never capped', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);
      const art = artworkSize(svg);

      for (const zoom of ZOOMS) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        expect(parseFloat(svg.getAttribute('width')!)).toBeCloseTo(
          (art.width * 205 * zoom) / 100,
          4,
        );
      }
    });

    it('holds the same distance from the verses at every zoom', () => {
      // In map units, not screen pixels: the book labels use a clamped screen
      // gap and so drift against the verses, which is exactly what the title
      // must not do.
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);

      const gaps = ZOOMS.map((zoom) => {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        const torahTopOnScreen = TORAH_TOP_Y * zoom;
        return (torahTopOnScreen - parseFloat(svg.style.top)) / zoom;
      });

      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
    });

    it('keeps its size against the verses at every zoom', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);

      const widths = ZOOMS.map((zoom) => {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        return parseFloat(svg.getAttribute('width')!) / zoom;
      });

      for (const w of widths) expect(w).toBeCloseTo(widths[0], 6);
    });

    it('tracks the pan', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);
      const topY = parseFloat(svg.dataset.topY!);

      updateMapTitlePosition(title, { x: 100, y: 50 }, 0.3);

      expect(parseFloat(svg.style.left)).toBeCloseTo((500 + 100) * 0.3, 5);
      expect(parseFloat(svg.style.top)).toBeCloseTo((topY + 50) * 0.3, 5);
    });

    it('scales as one piece, so the lines cannot drift against each other', () => {
      // Sizing the artwork through its viewBox is what holds the three
      // baselines in proportion; laying each line out per size does not, as
      // the font metrics round differently at every size.
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);
      const art = artworkSize(svg);

      for (const zoom of ZOOMS) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        const w = parseFloat(svg.getAttribute('width')!);
        const h = parseFloat(svg.getAttribute('height')!);
        expect(w / h).toBeCloseTo(art.width / art.height, 6);
      }
    });

    it('never fades: paint does not thin out as you lean in', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);

      for (const zoom of ZOOMS) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        expect(svg.style.opacity).toBe('');
      }
    });
  });
});
