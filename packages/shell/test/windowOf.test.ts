import { describe, it, expect } from 'vitest';
import { windowOf } from '../src/overlays/windowOf.ts';

const rows = (n: number) => Array<number>(n).fill(10);

describe('the rows a scroll box shows', () => {
  it('is every row when they all fit', () => {
    expect(windowOf(rows(3), 0, 100, 2)).toEqual({ start: 0, end: 3, before: 0, after: 0 });
  });

  it('is the rows in view and a margin, with the rest as space', () => {
    expect(windowOf(rows(100), 500, 100, 2)).toEqual({
      start: 48,
      end: 62,
      before: 480,
      after: 380,
    });
  });

  it('stops at the ends of the list', () => {
    expect(windowOf(rows(100), 0, 100, 2)).toEqual({ start: 0, end: 12, before: 0, after: 880 });
    expect(windowOf(rows(100), 900, 100, 2)).toEqual({
      start: 88,
      end: 100,
      before: 880,
      after: 0,
    });
  });

  it('follows rows of different heights', () => {
    expect(windowOf([10, 50, 10, 10], 20, 10, 0)).toEqual({
      start: 1,
      end: 2,
      before: 10,
      after: 20,
    });
  });

  it('is empty for an empty list', () => {
    expect(windowOf([], 0, 100, 2)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
  });
});
