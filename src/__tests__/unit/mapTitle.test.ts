import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMapTitle, updateMapTitlePosition, titleOpacity } from '../../mapTitle';
import { createVerse } from '../helpers';
import { bookLabelRise } from '../../labels';
import { fitZoom } from '../../camera';

// A Torah row starting at x=1000 above a Prophets row reaching back to x=0:
// the empty corner is 0..1000 wide, so the title centres on x=500.
const VERSES = [
  createVerse({ book: 'Genesis', x: 1400, y: 0 }),
  createVerse({ book: 'Deuteronomy', x: 1000, y: 40 }),
  createVerse({ book: 'Isaiah', x: 600, y: 500 }),
  createVerse({ book: 'Malachi', x: 0, y: 500 }),
];
const isTorah = (book: string): boolean => book === 'Genesis' || book === 'Deuteronomy';
const VIEWPORT = { width: 1200, height: 800 };

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

      expect(title.querySelector('.title-he')?.textContent).toBe('מפת התנ״ך');
      expect(title.querySelector('.title-name')?.textContent).toBe('Torahmap');
      expect(title.querySelector('.title-tagline')?.textContent).toBe(
        'A visual concordance to the Hebrew Bible',
      );
    });

    it('centres on the gap between the map’s left edge and the Torah’s', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      expect(parseFloat(block.dataset.centreX!)).toBe(500);
    });

    it('takes its vertical anchor from the top of the Torah', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      expect(parseFloat(block.dataset.topY!)).toBe(0);
    });

    it('survives an empty layout', () => {
      const title = createMapTitle([], container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      expect(parseFloat(block.dataset.centreX!)).toBe(0);
      expect(parseFloat(block.dataset.topY!)).toBe(0);
    });
  });

  describe('updateMapTitlePosition', () => {
    it('places the block from pan and zoom', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      updateMapTitlePosition(title, { x: 100, y: 50 }, 0.3, VIEWPORT);

      expect(parseFloat(block.style.left)).toBeCloseTo((500 + 100) * 0.3, 5);
      expect(parseFloat(block.style.top)).toBeCloseTo((0 + 50) * 0.3 - bookLabelRise(0.3), 5);
    });

    it('starts the block on the same line the book labels start from', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      // The book labels' own top, from labels.ts, for the Torah's first row.
      for (const zoom of [0.1, 0.3, 0.8]) {
        updateMapTitlePosition(title, { x: 0, y: 0 }, zoom, VIEWPORT);
        expect(parseFloat(block.style.top)).toBeCloseTo(-bookLabelRise(zoom), 5);
      }
    });

    it('grows with the zoom until it is capped', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      updateMapTitlePosition(title, { x: 0, y: 0 }, 0.2, VIEWPORT);
      expect(parseFloat(block.style.fontSize)).toBeCloseTo(205 * 0.2, 5);

      updateMapTitlePosition(title, { x: 0, y: 0 }, 5, VIEWPORT);
      expect(parseFloat(block.style.fontSize)).toBe(130);
    });

    it('sizes only the block, so its three lines hold their proportions', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;

      updateMapTitlePosition(title, { x: 0, y: 0 }, 0.4, VIEWPORT);

      expect(block.style.fontSize).not.toBe('');
      for (const line of block.children) {
        expect((line as HTMLElement).style.fontSize).toBe('');
      }
    });
  });

  describe('titleOpacity', () => {
    const FIT = 0.4;

    it('is full while the whole map is in view', () => {
      expect(titleOpacity(FIT * 0.5, FIT)).toBe(1);
      expect(titleOpacity(FIT, FIT)).toBe(1);
    });

    it('is gone once you have zoomed in to explore', () => {
      expect(titleOpacity(FIT * 1.7, FIT)).toBe(0);
      expect(titleOpacity(FIT * 10, FIT)).toBe(0);
    });

    it('falls away between the two', () => {
      expect(titleOpacity(FIT * 1.2, FIT)).toBeGreaterThan(titleOpacity(FIT * 1.5, FIT));
      expect(titleOpacity(FIT * 1.375, FIT)).toBeCloseTo(0.5, 5);
    });

    it('reads the same at the fitting zoom of any window', () => {
      // A large monitor fits the map at a far higher zoom than a laptop. The
      // title must open at full strength on both.
      for (const fit of [0.15, 0.32, 0.9, 2]) {
        expect(titleOpacity(fit, fit)).toBe(1);
        expect(titleOpacity(fit * 1.4, fit)).toBeCloseTo(titleOpacity(0.32 * 1.4, 0.32), 5);
      }
    });
  });

  describe('the fade against a real viewport', () => {
    it('opens at full strength on the view that fits the map', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;
      const box = JSON.parse(block.dataset.box!);
      const fit = fitZoom(box, VIEWPORT.width, VIEWPORT.height);

      updateMapTitlePosition(title, { x: 0, y: 0 }, fit, VIEWPORT);

      expect(parseFloat(block.style.opacity)).toBe(1);
    });

    it('has gone by the time the map is well past fitting', () => {
      const title = createMapTitle(VERSES, container, isTorah);
      const block = title.firstElementChild as HTMLElement;
      const box = JSON.parse(block.dataset.box!);
      const fit = fitZoom(box, VIEWPORT.width, VIEWPORT.height);

      updateMapTitlePosition(title, { x: 0, y: 0 }, fit * 2, VIEWPORT);

      expect(parseFloat(block.style.opacity)).toBe(0);
    });
  });
});
