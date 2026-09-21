import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMapTitle, updateMapTitlePosition, type MapTitle } from '../../mapTitle';
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

const at = (zoom: number, x = 0, y = 0): { x: number; y: number; zoom: number } => ({ x, y, zoom });

describe('mapTitle', () => {
  let container: HTMLElement;
  let title: MapTitle;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    title = createMapTitle(VERSES, container, isTorah);
  });

  afterEach(() => {
    container.remove();
  });

  describe('createMapTitle', () => {
    it('keeps the title out of the book-label container, which rewrites its children', () => {
      expect(container.querySelector('#map-title')).not.toBeNull();
      expect(title.svg.closest('#book-labels')).toBeNull();
    });

    it('carries the Hebrew name, the English name and the tagline', () => {
      const lines = [...title.svg.querySelectorAll('text')].map((t) => t.textContent);

      expect(lines).toEqual(['מפת התנ״ך', 'Torahmap', 'A visual concordance to the Hebrew Bible']);
    });

    it('centres on the gap between the map’s left edge and the Torah’s', () => {
      expect(title.centreX).toBe(500);
    });

    it('sits above the Torah', () => {
      expect(title.topY).toBeLessThan(TORAH_TOP_Y);
    });

    it('survives an empty layout', () => {
      const empty = createMapTitle([], container, isTorah);

      expect(empty.centreX).toBe(0);
      expect(Number.isFinite(empty.topY)).toBe(true);
    });
  });

  describe('it is painted on the map', () => {
    it('grows with the zoom and is never capped', () => {
      const widths = ZOOMS.map((zoom) => {
        updateMapTitlePosition(title, at(zoom));
        return parseFloat(title.svg.getAttribute('width')!) / zoom;
      });

      for (const w of widths) expect(w).toBeCloseTo(widths[0], 6);
    });

    it('holds the same distance from the verses at every zoom', () => {
      // In map units, not screen pixels: the book labels use a clamped screen
      // gap and so drift against the verses, which is what this must not do.
      const gaps = ZOOMS.map((zoom) => {
        updateMapTitlePosition(title, at(zoom));
        return (TORAH_TOP_Y * zoom - parseFloat(title.svg.style.top)) / zoom;
      });

      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
    });

    it('tracks the pan', () => {
      updateMapTitlePosition(title, at(0.3, 100, 50));

      expect(parseFloat(title.svg.style.left)).toBeCloseTo((500 + 100) * 0.3, 5);
      expect(parseFloat(title.svg.style.top)).toBeCloseTo((title.topY + 50) * 0.3, 5);
    });

    it('keeps the artwork’s own proportions at every zoom', () => {
      for (const zoom of ZOOMS) {
        updateMapTitlePosition(title, at(zoom));
        const w = parseFloat(title.svg.getAttribute('width')!);
        const h = parseFloat(title.svg.getAttribute('height')!);
        expect(h / w).toBeCloseTo(title.aspect, 6);
      }
    });

    it('never fades: paint does not thin out as you lean in', () => {
      for (const zoom of ZOOMS) {
        updateMapTitlePosition(title, at(zoom));
        expect(title.svg.style.opacity).toBe('');
      }
    });
  });
});
