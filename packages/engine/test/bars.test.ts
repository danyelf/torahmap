import { describe, it, expect } from 'vitest';
import { gapsToRightNeighbour, SQUARE_GAP, type MapItem } from '../src/index.ts';
import { createItem } from './fixtures.ts';

const at = (id: string, x: number, y = 0, size = 6): MapItem => createItem({ id, x, y, size });

describe('gapsToRightNeighbour', () => {
  it('reaches from a square to the next one on its row', () => {
    const gaps = gapsToRightNeighbour([at('a', 0), at('b', 6), at('c', 12)]);
    expect(gaps[0]).toBe(SQUARE_GAP);
    expect(gaps[1]).toBe(SQUARE_GAP);
  });

  it('leaves the last square of a row its own width', () => {
    expect(gapsToRightNeighbour([at('a', 0), at('b', 6)])[1]).toBe(0);
  });

  it('takes the nearest square to the right, in any order', () => {
    const gaps = gapsToRightNeighbour([at('far', 12), at('a', 0), at('near', 7)]);
    expect(gaps[1]).toBe(3);
  });

  it('never reaches left', () => {
    expect(gapsToRightNeighbour([at('a', 6), at('b', 0)])[0]).toBe(0);
  });

  it('counts squares jittered up or down a little as the same row', () => {
    expect(gapsToRightNeighbour([at('a', 0, 0), at('b', 6, 1.5)])[0]).toBe(SQUARE_GAP);
  });

  it('does not reach into the row above or below', () => {
    expect(gapsToRightNeighbour([at('a', 0, 0), at('b', 6, 6)])[0]).toBe(0);
  });

  it('does not cross a gap wider than a square', () => {
    const size = 6;
    const right = size - SQUARE_GAP;
    const gaps = gapsToRightNeighbour([at('a', 0), at('b', right + size), at('c', 100)]);
    expect(gaps[0]).toBe(size);
    expect(gaps[1]).toBe(0);
  });

  it('does not join squares of different sizes', () => {
    expect(gapsToRightNeighbour([at('a', 0, 0, 6), at('b', 6, 0, 8)])[0]).toBe(0);
  });

  it('reaches no further than the neighbour where squares overlap', () => {
    expect(gapsToRightNeighbour([at('a', 0), at('b', 3)])[0]).toBe(0);
  });
});
