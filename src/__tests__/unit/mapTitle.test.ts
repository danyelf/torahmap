import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMapTitle, updateMapTitlePosition, titleOpacity, artworkSize } from '../../mapTitle';
import { createVerse } from '../helpers';
import { bookLabelRise } from '../../labels';

// A Torah row starting at x=1000 above a Prophets row reaching back to x=0:
// the empty corner is 0..1000 wide, so the title centres on x=500.
const VERSES = [
  createVerse({ book: 'Genesis', x: 1400, y: 0 }),
  createVerse({ book: 'Deuteronomy', x: 1000, y: 40 }),
  createVerse({ book: 'Isaiah', x: 600, y: 500 }),
  createVerse({ book: 'Malachi', x: 0, y: 500 }),
];
const isTorah = (book: string): boolean => book === 'Genesis' || book === 'Deuteronomy';

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

    it('takes its vertical anchor from the top of the Torah', () => {
      const title = createMapTitle(VERSES, container, isTorah);

      expect(parseFloat(svgOf(title).dataset.topY!)).toBe(0);
    });

    it('survives an empty layout', () => {
      const title = createMapTitle([], container, isTorah);

      expect(parseFloat(svgOf(title).dataset.centreX!)).toBe(0);
      expect(parseFloat(svgOf(title).dataset.topY!)).toBe(0);
    });
  });

  describe('updateMapTitlePosition', () => {
    it('places the artwork from pan and zoom', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);

      updateMapTitlePosition(title, { x: 100, y: 50 }, 0.3);

      expect(parseFloat(svg.style.left)).toBeCloseTo((500 + 100) * 0.3, 5);
      expect(parseFloat(svg.style.top)).toBeCloseTo((0 + 50) * 0.3 - bookLabelRise(0.3), 5);
    });

    it('starts the artwork on the same line the book labels start from', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);

      for (const zoom of [0.1, 0.3, 0.8]) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        expect(parseFloat(svg.style.top)).toBeCloseTo(-bookLabelRise(zoom), 5);
      }
    });

    it('grows with the zoom until it is capped', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);
      const art = artworkSize(svg);

      updateMapTitlePosition(title, { x: 0, y: 0 }, 0.2);
      expect(parseFloat(svg.getAttribute('width')!)).toBeCloseTo((art.width * 205 * 0.2) / 100, 4);

      updateMapTitlePosition(title, { x: 0, y: 0 }, 5);
      expect(parseFloat(svg.getAttribute('width')!)).toBeCloseTo((art.width * 130) / 100, 4);
    });

    it('scales as one piece, so the lines cannot drift against each other', () => {
      // Sizing the artwork through its viewBox is what holds the three
      // baselines in proportion; laying each line out per size does not, as
      // the font metrics round differently at every size.
      const title = createMapTitle(VERSES, container, isTorah);
      const svg = svgOf(title);
      const art = artworkSize(svg);

      for (const zoom of [0.05, 0.2, 0.4, 0.63, 2]) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom);
        const w = parseFloat(svg.getAttribute('width')!);
        const h = parseFloat(svg.getAttribute('height')!);
        expect(w / h).toBeCloseTo(art.width / art.height, 6);
      }
    });
  });

  describe('titleOpacity', () => {
    it('holds full strength well past the view that fits the map', () => {
      expect(titleOpacity(0.3)).toBe(1);
      expect(titleOpacity(1)).toBe(1);
      expect(titleOpacity(1.5)).toBe(1);
    });

    it('is gone only once the verses themselves are worth reading', () => {
      expect(titleOpacity(4)).toBe(0);
      expect(titleOpacity(10)).toBe(0);
    });

    it('falls away between the two', () => {
      expect(titleOpacity(2.75)).toBeCloseTo(0.5, 5);
      expect(titleOpacity(2)).toBeGreaterThan(titleOpacity(3));
    });
  });
});
