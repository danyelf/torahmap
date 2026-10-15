import { describe, it, expect } from 'vitest';
import { bookBoxes } from '../../src/labels.ts';
import { createVerse } from '../helpers/index';
import type { Book } from '../../src/types';

const BOOKS: Book[] = [
  { name: 'Genesis', hebrewName: 'בראשית', section: 'torah', chapters: [] },
  { name: 'Joshua', hebrewName: 'יהושע', section: 'neviim', chapters: [] },
];

describe('bookBoxes', () => {
  it("boxes each book's verses: their left and right edges and their top", () => {
    const [genesis] = bookBoxes(
      [
        createVerse({ book: 'Genesis', x: 10, y: 50, size: 6 }),
        createVerse({ book: 'Genesis', x: 40, y: 20, size: 6 }),
        createVerse({ book: 'Genesis', x: 25, y: 80, size: 6 }),
      ],
      BOOKS,
    );
    expect(genesis).toMatchObject({ minX: 10, maxX: 46, minY: 20 });
  });

  it('names each book and its section, in the order the books first come', () => {
    const boxes = bookBoxes(
      [
        createVerse({ book: 'Joshua', x: 0, y: 0 }),
        createVerse({ book: 'Genesis', x: 0, y: 0 }),
        createVerse({ book: 'Joshua', x: 0, y: 0 }),
      ],
      BOOKS,
    );
    expect(boxes.map(({ name, hebrewName, section }) => [name, hebrewName, section])).toEqual([
      ['Joshua', 'יהושע', 'neviim'],
      ['Genesis', 'בראשית', 'torah'],
    ]);
  });
});
