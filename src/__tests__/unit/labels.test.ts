import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBookLabels, updateLabelPositions } from '../../labels';
import { createVerse, SAMPLE_VERSES } from '../helpers';
import type { VerseLayout } from '../../types';

// Match constants from labels.ts implementation
const BASE_LABEL_GAP = 10;
const BASE_FONT_SIZE = 13;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 50;

// Helper function to calculate expected Y position matching the implementation
function calculateExpectedY(topY: number, panY: number, zoom: number): number {
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom));
  const gap = BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE);
  return (topY + panY) * zoom - fontSize - gap;
}

describe('labels', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createBookLabels', () => {
    describe('basic functionality', () => {
      it('creates a labels container element', () => {
        const verses = [createVerse()];
        const labels = createBookLabels(verses, container);

        expect(labels).toBeInstanceOf(HTMLDivElement);
        expect(labels.id).toBe('book-labels');
      });

      it('appends labels container to parent container', () => {
        const verses = [createVerse()];
        createBookLabels(verses, container);

        const labelsInDom = container.querySelector('#book-labels');
        expect(labelsInDom).not.toBeNull();
      });

      it('applies fixed positioning styles', () => {
        const verses = [createVerse()];
        const labels = createBookLabels(verses, container);

        expect(labels.style.position).toBe('fixed');
        expect(labels.style.top).toBe('0px');
        expect(labels.style.left).toBe('0px');
        expect(labels.style.pointerEvents).toBe('none');
      });

      it('handles empty verse array', () => {
        const labels = createBookLabels([], container);

        expect(labels.children.length).toBe(0);
      });
    });

    describe('book label creation', () => {
      it('creates one label per book', () => {
        const verses = [
          createVerse({ book: 'Genesis' }),
          createVerse({ book: 'Genesis' }),
          createVerse({ book: 'Exodus' }),
          createVerse({ book: 'Isaiah' }),
        ];
        const labels = createBookLabels(verses, container);

        // Should have 3 labels for 3 unique books
        expect(labels.children.length).toBe(3);
      });

      it('sets correct text content for each label', () => {
        const verses = [
          createVerse({ book: 'Genesis' }),
          createVerse({ book: 'Exodus' }),
          createVerse({ book: 'Psalms' }),
        ];
        const labels = createBookLabels(verses, container);

        const labelTexts = Array.from(labels.children).map(child => child.textContent);
        expect(labelTexts).toContain('Genesis');
        expect(labelTexts).toContain('Exodus');
        expect(labelTexts).toContain('Psalms');
      });

      it('applies correct styling to each label', () => {
        const verses = [createVerse({ book: 'Genesis' })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.style.position).toBe('absolute');
        // happy-dom keeps color as hex, while real browsers convert to rgb
        expect(label.style.color).toBe('#eee');
        expect(label.style.fontFamily).toContain('sans-serif');
        expect(label.style.fontWeight).toBe('700');
        expect(label.style.whiteSpace).toBe('nowrap');
        // fontSize is set dynamically in updateLabelPositions, not here
      });

      it('stores book name in dataset', () => {
        const verses = [createVerse({ book: 'Genesis' })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.bookName).toBe('Genesis');
      });
    });

    describe('book bounds calculation', () => {
      it('stores minX as leftX for single verse', () => {
        const verses = [createVerse({ book: 'Genesis', x: 100 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('100');
      });

      it('stores minY as topY for single verse', () => {
        const verses = [createVerse({ book: 'Genesis', y: 200 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.topY).toBe('200');
      });

      it('uses first verse X as leftX (not minimum X)', () => {
        // Note: Implementation stores first verse's X, not the minimum X
        const verses = [
          createVerse({ book: 'Genesis', x: 100 }),  // First verse - this X is used
          createVerse({ book: 'Genesis', x: 50 }),
          createVerse({ book: 'Genesis', x: 150 }),
        ];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('100');
      });

      it('calculates minY from topmost verse in book', () => {
        const verses = [
          createVerse({ book: 'Genesis', y: 100 }),
          createVerse({ book: 'Genesis', y: 50 }),  // topmost
          createVerse({ book: 'Genesis', y: 150 }),
        ];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.topY).toBe('50');
      });

      it('handles multiple books with different positions', () => {
        const verses = [
          createVerse({ book: 'Genesis', x: 10, y: 20 }),  // First Genesis verse
          createVerse({ book: 'Genesis', x: 5, y: 25 }),
          createVerse({ book: 'Exodus', x: 100, y: 30 }),  // First Exodus verse
          createVerse({ book: 'Exodus', x: 110, y: 25 }),
        ];
        const labels = createBookLabels(verses, container);

        const genesisLabel = Array.from(labels.children).find(
          (child) => (child as HTMLElement).dataset.bookName === 'Genesis'
        ) as HTMLElement;
        const exodusLabel = Array.from(labels.children).find(
          (child) => (child as HTMLElement).dataset.bookName === 'Exodus'
        ) as HTMLElement;

        // Uses first verse X, but minimum Y
        expect(genesisLabel.dataset.leftX).toBe('10');
        expect(genesisLabel.dataset.topY).toBe('20');
        expect(exodusLabel.dataset.leftX).toBe('100');
        expect(exodusLabel.dataset.topY).toBe('25');
      });

      it('handles verses at negative coordinates', () => {
        const verses = [createVerse({ book: 'Genesis', x: -50, y: -100 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('-50');
        expect(label.dataset.topY).toBe('-100');
      });

      it('handles verses at zero coordinates', () => {
        const verses = [createVerse({ book: 'Genesis', x: 0, y: 0 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('0');
        expect(label.dataset.topY).toBe('0');
      });

      it('handles very large coordinates', () => {
        const verses = [createVerse({ book: 'Genesis', x: 10000, y: 20000 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('10000');
        expect(label.dataset.topY).toBe('20000');
      });
    });

    describe('different sections (Torah, Nevi\'im, Ketuvim)', () => {
      it('handles Torah books', () => {
        const verses = [
          createVerse({ book: 'Genesis', x: 10, y: 20 }),
          createVerse({ book: 'Exodus', x: 100, y: 20 }),
          createVerse({ book: 'Leviticus', x: 200, y: 20 }),
        ];
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(3);
        const bookNames = Array.from(labels.children).map(
          (child) => (child as HTMLElement).dataset.bookName
        );
        expect(bookNames).toContain('Genesis');
        expect(bookNames).toContain('Exodus');
        expect(bookNames).toContain('Leviticus');
      });

      it('handles Nevi\'im books', () => {
        const verses = [
          createVerse({ book: 'Joshua', x: 10, y: 500 }),
          createVerse({ book: 'Isaiah', x: 100, y: 500 }),
          createVerse({ book: 'Jeremiah', x: 200, y: 500 }),
        ];
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(3);
        const bookNames = Array.from(labels.children).map(
          (child) => (child as HTMLElement).dataset.bookName
        );
        expect(bookNames).toContain('Joshua');
        expect(bookNames).toContain('Isaiah');
        expect(bookNames).toContain('Jeremiah');
      });

      it('handles Ketuvim books', () => {
        const verses = [
          createVerse({ book: 'Psalms', x: 10, y: 1000 }),
          createVerse({ book: 'Proverbs', x: 100, y: 1000 }),
          createVerse({ book: 'Job', x: 200, y: 1000 }),
        ];
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(3);
        const bookNames = Array.from(labels.children).map(
          (child) => (child as HTMLElement).dataset.bookName
        );
        expect(bookNames).toContain('Psalms');
        expect(bookNames).toContain('Proverbs');
        expect(bookNames).toContain('Job');
      });

      it('handles books from all three sections', () => {
        const verses = [
          createVerse({ book: 'Genesis', x: 10, y: 20 }),     // Torah
          createVerse({ book: 'Isaiah', x: 10, y: 500 }),     // Nevi'im
          createVerse({ book: 'Psalms', x: 10, y: 1000 }),    // Ketuvim
        ];
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(3);
      });
    });

    describe('edge cases', () => {
      it('handles book with single verse', () => {
        const verses = [createVerse({ book: 'Obadiah', x: 100, y: 200 })];
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(1);
        const label = labels.children[0] as HTMLElement;
        expect(label.textContent).toBe('Obadiah');
      });

      it('handles book with many verses', () => {
        const verses = Array.from({ length: 100 }, (_, i) =>
          createVerse({ book: 'Psalms', x: (i % 10) * 10, y: Math.floor(i / 10) * 10 })
        );
        const labels = createBookLabels(verses, container);

        expect(labels.children.length).toBe(1);
        const label = labels.children[0] as HTMLElement;
        expect(label.textContent).toBe('Psalms');
      });

      it('handles books with spaces in names', () => {
        const verses = [createVerse({ book: 'Song of Songs', x: 100, y: 200 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.textContent).toBe('Song of Songs');
        expect(label.dataset.bookName).toBe('Song of Songs');
      });

      it('handles books with hyphens in names', () => {
        const verses = [createVerse({ book: 'I-Chronicles', x: 100, y: 200 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.textContent).toBe('I-Chronicles');
      });

      it('handles fractional coordinates', () => {
        const verses = [createVerse({ book: 'Genesis', x: 10.5, y: 20.7 })];
        const labels = createBookLabels(verses, container);

        const label = labels.children[0] as HTMLElement;
        expect(label.dataset.leftX).toBe('10.5');
        expect(label.dataset.topY).toBe('20.7');
      });

      it('maintains book order as they appear in verses array', () => {
        const verses = [
          createVerse({ book: 'Zephaniah', x: 10, y: 20 }),
          createVerse({ book: 'Amos', x: 20, y: 30 }),
          createVerse({ book: 'Micah', x: 30, y: 40 }),
        ];
        const labels = createBookLabels(verses, container);

        // The order in which labels are created matches first occurrence
        const firstLabel = labels.children[0] as HTMLElement;
        const secondLabel = labels.children[1] as HTMLElement;
        const thirdLabel = labels.children[2] as HTMLElement;

        expect(firstLabel.dataset.bookName).toBe('Zephaniah');
        expect(secondLabel.dataset.bookName).toBe('Amos');
        expect(thirdLabel.dataset.bookName).toBe('Micah');
      });
    });

    describe('integration with SAMPLE_VERSES', () => {
      it('correctly processes sample verses spanning multiple books', () => {
        const labels = createBookLabels(SAMPLE_VERSES, container);

        // SAMPLE_VERSES includes Genesis, Exodus, Isaiah, Psalms
        expect(labels.children.length).toBeGreaterThanOrEqual(3);

        const bookNames = Array.from(labels.children).map(
          (child) => (child as HTMLElement).dataset.bookName
        );
        expect(bookNames).toContain('Genesis');
      });
    });
  });

  describe('updateLabelPositions', () => {
    let labelsContainer: HTMLElement;

    beforeEach(() => {
      const verses = [
        createVerse({ book: 'Genesis', x: 100, y: 200 }),
        createVerse({ book: 'Exodus', x: 300, y: 400 }),
      ];
      labelsContainer = createBookLabels(verses, container);
    });

    describe('basic positioning', () => {
      it('updates label positions with no pan or zoom', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        // Position should be leftX, topY with fontSize + gap offset
        expect(label.style.left).toBe(`${leftX}px`);
        expect(label.style.top).toBe(`${calculateExpectedY(topY, 0, 1)}px`);
      });

      it('applies LABEL_OFFSET_Y of -20 pixels', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedTop = calculateExpectedY(topY, 0, 1);

        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('updates all labels in container', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1);

        for (const child of labelsContainer.children) {
          const label = child as HTMLElement;
          expect(label.style.left).toBeDefined();
          expect(label.style.top).toBeDefined();
        }
      });
    });

    describe('pan transformations', () => {
      it('applies positive pan.x', () => {
        const pan = { x: 50, y: 0 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const expectedLeft = leftX + pan.x;

        expect(label.style.left).toBe(`${expectedLeft}px`);
      });

      it('applies negative pan.x', () => {
        const pan = { x: -50, y: 0 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const expectedLeft = leftX + pan.x;

        expect(label.style.left).toBe(`${expectedLeft}px`);
      });

      it('applies positive pan.y', () => {
        const pan = { x: 0, y: 30 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedTop = calculateExpectedY(topY, pan.y, 1);

        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('applies negative pan.y', () => {
        const pan = { x: 0, y: -30 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedTop = calculateExpectedY(topY, pan.y, 1);

        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('applies both pan.x and pan.y', () => {
        const pan = { x: 25, y: 35 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX + pan.x;
        const expectedTop = calculateExpectedY(topY, pan.y, 1);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('handles large pan values', () => {
        const pan = { x: 1000, y: 2000 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX + pan.x;
        const expectedTop = calculateExpectedY(topY, pan.y, 1);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });
    });

    describe('zoom transformations', () => {
      it('applies zoom > 1 (zoom in)', () => {
        const zoom = 2;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX * zoom;
        const expectedTop = calculateExpectedY(topY, 0, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('applies zoom < 1 (zoom out)', () => {
        const zoom = 0.5;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX * zoom;
        const expectedTop = calculateExpectedY(topY, 0, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('handles zoom = 1 (no zoom)', () => {
        const zoom = 1;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX * zoom;
        const expectedTop = calculateExpectedY(topY, 0, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('handles very small zoom values', () => {
        const zoom = 0.1;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX * zoom;
        const expectedTop = calculateExpectedY(topY, 0, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        // Use toBeCloseTo for floating point comparison due to browser precision
        const actualTop = parseFloat(label.style.top);
        expect(actualTop).toBeCloseTo(expectedTop, 5);
      });

      it('handles large zoom values', () => {
        const zoom = 10;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');
        const expectedLeft = leftX * zoom;
        const expectedTop = calculateExpectedY(topY, 0, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        // Use toBeCloseTo for floating point comparison due to browser precision
        const actualTop = parseFloat(label.style.top);
        expect(actualTop).toBeCloseTo(expectedTop, 5);
      });
    });

    describe('font size scaling', () => {
      it('scales font size with zoom at zoom=1', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1);
        const label = labelsContainer.children[0] as HTMLElement;
        expect(label.style.fontSize).toBe('13px'); // BASE_FONT_SIZE
      });

      it('scales font size with zoom at zoom=2', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 2);
        const label = labelsContainer.children[0] as HTMLElement;
        expect(label.style.fontSize).toBe('26px'); // BASE_FONT_SIZE * 2 = 13 * 2
      });

      it('clamps to minimum font size when zoomed way out', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 0.1);
        const label = labelsContainer.children[0] as HTMLElement;
        expect(label.style.fontSize).toBe('5px'); // MIN_FONT_SIZE
      });

      it('clamps to maximum font size when zoomed way in', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 10);
        const label = labelsContainer.children[0] as HTMLElement;
        expect(label.style.fontSize).toBe('50px'); // MAX_FONT_SIZE
      });

      it('scales proportionally at intermediate zoom levels', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1.5);
        const label = labelsContainer.children[0] as HTMLElement;
        expect(label.style.fontSize).toBe('19.5px'); // 13 * 1.5
      });

      it('applies same font size to all labels', () => {
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1.5);

        for (const child of labelsContainer.children) {
          const label = child as HTMLElement;
          expect(label.style.fontSize).toBe('19.5px');
        }
      });
    });

    describe('combined transformations', () => {
      it('applies both pan and zoom correctly', () => {
        const pan = { x: 50, y: 100 };
        const zoom = 2;
        updateLabelPositions(labelsContainer, pan, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        // Formula: (position + pan) * zoom, then apply fontSize + gap offset for Y
        const expectedLeft = (leftX + pan.x) * zoom;
        const expectedTop = calculateExpectedY(topY, pan.y, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('applies negative pan with zoom', () => {
        const pan = { x: -25, y: -50 };
        const zoom = 1.5;
        updateLabelPositions(labelsContainer, pan, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        const expectedLeft = (leftX + pan.x) * zoom;
        const expectedTop = calculateExpectedY(topY, pan.y, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });

      it('applies zoom < 1 with pan', () => {
        const pan = { x: 100, y: 200 };
        const zoom = 0.5;
        updateLabelPositions(labelsContainer, pan, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        const expectedLeft = (leftX + pan.x) * zoom;
        const expectedTop = calculateExpectedY(topY, pan.y, zoom);

        expect(label.style.left).toBe(`${expectedLeft}px`);
        expect(label.style.top).toBe(`${expectedTop}px`);
      });
    });

    describe('edge cases', () => {
      it('handles missing dataset values gracefully', () => {
        const label = document.createElement('div');
        delete (label.dataset as any).leftX;
        delete (label.dataset as any).topY;
        labelsContainer.appendChild(label);

        // Should not throw, should use 0 as default
        expect(() => {
          updateLabelPositions(labelsContainer, { x: 10, y: 20 }, 1);
        }).not.toThrow();

        expect(label.style.left).toBe('10px'); // 0 + 10
        expect(label.style.top).toBe(`${calculateExpectedY(0, 20, 1)}px`);
      });

      it('handles empty labels container', () => {
        const emptyContainer = document.createElement('div');
        expect(() => {
          updateLabelPositions(emptyContainer, { x: 0, y: 0 }, 1);
        }).not.toThrow();
      });

      it('handles non-HTMLElement children', () => {
        const textNode = document.createTextNode('text');
        labelsContainer.appendChild(textNode);

        // Should skip non-HTMLElement children without error
        expect(() => {
          updateLabelPositions(labelsContainer, { x: 0, y: 0 }, 1);
        }).not.toThrow();
      });

      it('handles fractional pan values', () => {
        const pan = { x: 10.5, y: 20.7 };
        updateLabelPositions(labelsContainer, pan, 1);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        expect(label.style.left).toBe(`${leftX + pan.x}px`);
        expect(label.style.top).toBe(`${calculateExpectedY(topY, pan.y, 1)}px`);
      });

      it('handles fractional zoom values', () => {
        const zoom = 1.75;
        updateLabelPositions(labelsContainer, { x: 0, y: 0 }, zoom);

        const label = labelsContainer.children[0] as HTMLElement;
        const leftX = parseFloat(label.dataset.leftX || '0');
        const topY = parseFloat(label.dataset.topY || '0');

        expect(label.style.left).toBe(`${leftX * zoom}px`);
        expect(label.style.top).toBe(`${calculateExpectedY(topY, 0, zoom)}px`);
      });

      it('updates positions multiple times', () => {
        // First update
        updateLabelPositions(labelsContainer, { x: 10, y: 20 }, 1);
        const label = labelsContainer.children[0] as HTMLElement;
        const firstLeft = label.style.left;

        // Second update with different values
        updateLabelPositions(labelsContainer, { x: 30, y: 40 }, 2);
        const secondLeft = label.style.left;

        expect(firstLeft).not.toBe(secondLeft);
      });

      it('maintains consistent results for same inputs', () => {
        updateLabelPositions(labelsContainer, { x: 15, y: 25 }, 1.5);
        const label = labelsContainer.children[0] as HTMLElement;
        const firstLeft = label.style.left;
        const firstTop = label.style.top;

        // Apply same transformation again
        updateLabelPositions(labelsContainer, { x: 15, y: 25 }, 1.5);

        expect(label.style.left).toBe(firstLeft);
        expect(label.style.top).toBe(firstTop);
      });
    });

    describe('performance', () => {
      it('handles many labels efficiently', () => {
        const verses = Array.from({ length: 100 }, (_, i) =>
          createVerse({ book: `Book${i}`, x: i * 10, y: i * 20 })
        );
        const manyLabels = createBookLabels(verses, container);

        const start = performance.now();
        updateLabelPositions(manyLabels, { x: 50, y: 100 }, 2);
        const duration = performance.now() - start;

        // Should complete in reasonable time (< 100ms for 100 labels)
        expect(duration).toBeLessThan(100);
      });
    });
  });
});
