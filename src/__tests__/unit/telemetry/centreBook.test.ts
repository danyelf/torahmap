import { describe, expect, it } from 'vitest';
import { centreBook } from '../../../telemetry/centreBook.ts';
import type { TanakhLayout } from '../../../types.ts';

const verse = (book: string, x: number, y: number): TanakhLayout => ({
  book,
  chapter: 1,
  verse: 1,
  x,
  y,
  size: 2,
});
const verses = [verse('Genesis', 0, 0), verse('Exodus', 100, 0)];

describe('centreBook', () => {
  it('names the book under the middle of the screen', () => {
    // At zoom 1 the world point under the screen centre is (W/2 - camera.x, H/2 - camera.y).
    expect(centreBook(verses, { x: 400, y: 300, zoom: 1 }, 800, 600)).toBe('Genesis');
    expect(centreBook(verses, { x: 300, y: 300, zoom: 1 }, 800, 600)).toBe('Exodus');
  });

  it('names the nearest book when the middle falls between books', () => {
    expect(centreBook(verses, { x: 330, y: 300, zoom: 1 }, 800, 600)).toBe('Exodus');
  });

  it('accounts for zoom', () => {
    // At zoom 2 the world centre is (W/2/2 - camera.x) = 200 - 100 = 100.
    expect(centreBook(verses, { x: 100, y: 150, zoom: 2 }, 800, 600)).toBe('Exodus');
  });
});
