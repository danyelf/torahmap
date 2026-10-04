import { describe, it, expect } from 'vitest';
import { indexItems, sameItem } from '../../items.ts';

const square = (id: string) => ({ id, x: 0, y: 0, size: 1 });
const [a, b, c] = ['A.1.1', 'A.1.2', 'A.1.3'].map(square);

describe('sameItem', () => {
  it('compares by id, not by object', () => {
    expect(sameItem(a, square('A.1.1'))).toBe(true);
    expect(sameItem(a, b)).toBe(false);
  });

  it('treats two nulls as the same and one null as different', () => {
    expect(sameItem(null, null)).toBe(true);
    expect(sameItem(a, null)).toBe(false);
    expect(sameItem(null, a)).toBe(false);
  });
});

describe('indexItems', () => {
  const index = indexItems([a, b, c]);

  it('finds a square by id, and nothing for an id the map lacks', () => {
    expect(index.find('A.1.2')).toBe(b);
    expect(index.find('A.01.2')).toBeNull();
    expect(index.find('')).toBeNull();
  });

  it('steps forward and back in layout order', () => {
    expect(index.step(a, 1)).toBe(b);
    expect(index.step(c, -1)).toBe(b);
  });

  it('steps nowhere past either end', () => {
    expect(index.step(c, 1)).toBeNull();
    expect(index.step(a, -1)).toBeNull();
  });

  it('refuses a layout in which two squares share an id', () => {
    expect(() => indexItems([a, square('A.1.1')])).toThrow('A.1.1');
  });
});
