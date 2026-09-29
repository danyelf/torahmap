import { describe, expect, it } from 'vitest';
import { FACES, unloadedFaces } from '../fonts.ts';

describe('unloadedFaces', () => {
  it('names every face the page could not load', () => {
    const loaded = new Set([FACES[0]]);
    expect(unloadedFaces(FACES, (f) => loaded.has(f))).toEqual(FACES.slice(1));
  });

  it('is empty when every face loaded', () => {
    expect(unloadedFaces(FACES, () => true)).toEqual([]);
  });
});
