import { expect, test } from '@playwright/test';
import { apart, outsideOf, overlapping, tooSmallToTouch, type Box } from './geometry.ts';

const box = (name: string, x: number, y: number, width: number, height: number): Box => ({
  name,
  x,
  y,
  width,
  height,
});

test.describe('overlapping', () => {
  test('boxes that share only an edge do not overlap', () => {
    expect(overlapping([box('a', 0, 0, 10, 10), box('b', 10, 0, 10, 10)])).toEqual([]);
  });
  test('sub-pixel rounding at an edge is not an overlap', () => {
    expect(overlapping([box('a', 0, 0, 10.4, 10), box('b', 10, 0, 10, 10)])).toEqual([]);
  });
  test('names both boxes and the shared area', () => {
    expect(overlapping([box('a', 0, 0, 10, 10), box('b', 5, 5, 10, 10)])).toEqual([
      'a overlaps b by 5×5px',
    ]);
  });
});

test.describe('apart', () => {
  test('reports a box from each side that meet', () => {
    expect(apart([box('map', 0, 0, 100, 100)], [box('panel', 90, 0, 50, 100)])).toEqual([
      'map overlaps panel by 10×100px',
    ]);
  });
});

test.describe('outsideOf', () => {
  const screen = { x: 0, y: 0, width: 100, height: 100 };
  test('a box inside the frame passes', () => {
    expect(outsideOf([box('a', 10, 10, 20, 20)], screen)).toEqual([]);
  });
  test('names every side a box crosses', () => {
    expect(outsideOf([box('a', -5, 90, 20, 20)], screen)).toEqual([
      'a crosses the left, bottom edge',
    ]);
  });
});

test.describe('tooSmallToTouch', () => {
  test('passes a box at the minimum', () => {
    expect(tooSmallToTouch([box('a', 0, 0, 44, 44)], 44)).toEqual([]);
  });
  test('reports the measured size', () => {
    expect(tooSmallToTouch([box('a', 0, 0, 80, 20)], 44)).toEqual(['a is 80×20px, under 44']);
  });
});
