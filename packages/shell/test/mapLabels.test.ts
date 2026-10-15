import { describe, it, expect, beforeEach } from 'vitest';
import {
  bookLabelSize,
  createMapLabels,
  type BookBox,
  type MapLabelSettings,
} from '../src/mapLabels.ts';
import { HEBREW_LABEL_SCALE } from '../src/labelTypography.ts';

const book = (
  name: string,
  section: string,
  minX: number,
  maxX: number,
  minY: number,
): BookBox => ({
  name,
  hebrewName: `ה${name}`,
  section,
  minX,
  maxX,
  minY,
});

const BOOKS = [
  book('Genesis', 'torah', 0, 106, 0),
  book('Exodus', 'torah', 100, 106, 40),
  book('Joshua', 'neviim', 50, 56, 200),
];

const SETTINGS: MapLabelSettings = {
  sectionNames: {
    torah: { he: 'תורה', en: 'Five Books' },
    neviim: { he: 'נביאים', en: 'Prophets' },
  },
  sectionSize: { fontSize: 32, gapEm: 0.5 },
};

let parent: HTMLElement;
beforeEach(() => {
  parent = document.createElement('div');
});

function labels(books = BOOKS, settings = SETTINGS) {
  const move = createMapLabels(books, parent, settings);
  const all = [...parent.lastElementChild!.children] as HTMLElement[];
  return {
    move,
    books: all.filter((l) => l.classList.contains('book-label')),
    sections: all.filter((l) => l.dataset.section),
  };
}

describe('book labels', () => {
  it('names each book, Hebrew then English, the Hebrew set larger', () => {
    const { books } = labels();
    expect(books.map((l) => l.textContent)).toEqual([
      'הGenesis Genesis',
      'הExodus Exodus',
      'הJoshua Joshua',
    ]);
    const he = books[0].querySelector<HTMLElement>('.book-label-he')!;
    expect(he.style.fontSize).toBe(`${HEBREW_LABEL_SCALE}em`);
  });

  it("sits above its book's first row, its right edge on the book's, moving with the map", () => {
    const { move, books } = labels();
    for (const [pan, zoom] of [
      [{ x: 0, y: 0 }, 1],
      [{ x: -30, y: 12 }, 2],
      [{ x: 50, y: -5 }, 0.5],
    ] as const) {
      move(pan, zoom);
      expect(books[1].style.left).toBe(`${(106 + pan.x) * zoom}px`);
      expect(books[1].style.top).toBe(`${(40 + pan.y) * zoom - bookLabelSize(zoom).rise}px`);
      expect(books[1].style.transform).toBe('translateX(-100%)');
    }
  });

  it('grows with the zoom between a smallest and a largest size', () => {
    const { move, books } = labels();
    const sizeAt = (zoom: number) => {
      move({ x: 0, y: 0 }, zoom);
      return books[0].style.fontSize;
    };
    expect(sizeAt(1)).toBe('13px');
    expect(sizeAt(1.5)).toBe('19.5px');
    expect(sizeAt(0.1)).toBe('5px');
    expect(sizeAt(10)).toBe('50px');
  });

  it('drops its English where its book is too narrow on screen for it', () => {
    const { move, books } = labels();
    move({ x: 0, y: 0 }, 1);
    expect(books[0].classList.contains('narrow')).toBe(false);
    expect(books[1].classList.contains('narrow')).toBe(true);
    move({ x: 0, y: 0 }, 20);
    expect(books[1].classList.contains('narrow')).toBe(false);
  });
});

describe('a book label set as a tab', () => {
  const tab = { fontSize: 20, above: 40, inset: 6, minPx: 8 };
  const tabAt = (zoom: number, books = [book('Genesis', 'torah', 100, 106, 200)]) => {
    const {
      move,
      books: [label],
    } = labels(books, { ...SETTINGS, tab });
    move({ x: 10, y: 20 }, zoom);
    return label;
  };

  it('keeps its place in its book at every zoom, inset from the right edge', () => {
    for (const zoom of [0.5, 1, 4]) {
      const label = tabAt(zoom);
      expect(label.style.left).toBe(`${(106 - 6 + 10) * zoom}px`);
      expect(label.style.top).toBe(`${(200 - 40 + 20) * zoom}px`);
    }
  });

  it('scales with the map, without the bounds an ordinary label is held to', () => {
    expect(tabAt(0.1).style.fontSize).toBe('2px');
    expect(tabAt(10).style.fontSize).toBe('200px');
  });

  it('fades out below its smallest size', () => {
    expect(tabAt(0.39).style.opacity).toBe('0');
    expect(tabAt(0.4).style.opacity).toBe('');
  });

  it('drops its English, at every zoom, where its book is narrower than the English takes', () => {
    const narrow = [book('Genesis', 'torah', 100, 200, 0)];
    const wide = [book('Genesis', 'torah', 0, 200, 0)];
    for (const zoom of [0.5, 5]) {
      expect(tabAt(zoom, narrow).classList.contains('narrow')).toBe(true);
      expect(tabAt(zoom, wide).classList.contains('narrow')).toBe(false);
    }
  });
});

describe('section labels', () => {
  it('names each section once, in the order its books come, Hebrew then English', () => {
    const { sections } = labels();
    expect(sections.map((l) => l.dataset.section)).toEqual(['torah', 'neviim']);
    expect(sections.map((l) => l.textContent)).toEqual(['תורה Five Books', 'נביאים Prophets']);
  });

  it("sits beside its books' right edge, level with the tops of their labels", () => {
    const { move, sections } = labels();
    move({ x: 0, y: 5 }, 1);
    // Right edge 106, plus half an em of 32px.
    expect(sections[0].style.left).toBe('122px');
    expect(sections[0].style.top).toBe(`${5 - bookLabelSize(1).rise}px`);
    expect(sections[0].style.transform).toContain('rotate(90deg)');
  });

  it('takes the size and gap it is given', () => {
    const { move, sections } = labels(BOOKS, {
      ...SETTINGS,
      sectionSize: { fontSize: 40, gapEm: 1.5 },
    });
    move({ x: 0, y: 0 }, 1);
    // Right edge 106, plus one and a half ems of 40px.
    expect(sections[0].style.left).toBe('166px');
    expect(sections[0].style.fontSize).toBe('40px');
  });

  it('shrinks without a floor, but stops growing when zoomed in', () => {
    const { move, sections } = labels();
    move({ x: 0, y: 0 }, 0.1);
    expect(sections[0].style.fontSize).toBe('3.2px');
    move({ x: 0, y: 0 }, 10);
    expect(sections[0].style.fontSize).toBe('64px');
  });
});
