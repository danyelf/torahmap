import { describe, expect, it } from 'vitest';
import { placeNames, type Name } from '../src/names.ts';

const name = (over: Partial<Name>): Name => ({
  x: 0,
  y: 0,
  dy: 0,
  width: 40,
  height: 10,
  minY: 0,
  maxX: 1000,
  maxY: 1000,
  moves: true,
  ...over,
});

describe('placeNames', () => {
  it('sets a name at its place, scaled by the zoom, and its own size in pixels', () => {
    expect(placeNames([name({ x: 100, y: 200 })], 0.5)).toEqual([100]);
  });

  it('raises a name standing above its point by its height', () => {
    expect(placeNames([name({ y: 200, dy: -10, minY: 100 })], 1)).toEqual([190]);
  });

  it('moves a name that runs into an earlier one down below it', () => {
    expect(placeNames([name({}), name({ x: 20 })], 1)).toEqual([0, 10]);
  });

  it('keeps moving it down past every name in the way', () => {
    expect(placeNames([name({}), name({ y: 10 }), name({ x: 20 })], 1)).toEqual([0, 10, 20]);
  });

  it('leaves out a name with no room left below', () => {
    expect(placeNames([name({}), name({ x: 20, maxY: 15 })], 1)).toEqual([0, null]);
  });

  it('leaves out a name that does not move rather than move it', () => {
    expect(placeNames([name({}), name({ x: 20, moves: false })], 1)).toEqual([0, null]);
  });

  it('leaves out a name wider than its room, which narrows as the map zooms out', () => {
    const wide = name({ maxX: 50 });
    expect(placeNames([wide], 1)).toEqual([0]);
    expect(placeNames([wide], 0.5)).toEqual([null]);
  });

  it('leaves out a name taller than the room above its point', () => {
    const above = name({ y: 100, dy: -10, minY: 90 });
    expect(placeNames([above], 1)).toEqual([90]);
    expect(placeNames([above], 0.5)).toEqual([null]);
  });

  it('shows names far apart side by side, however many', () => {
    const many = Array.from({ length: 500 }, (_, i) => name({ x: i * 50 + 1, maxX: 1e6 }));
    expect(placeNames(many, 1).every((top) => top === 0)).toBe(true);
  });
});
