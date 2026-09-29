import { describe, expect, it } from 'vitest';
import { FACES, HEBREW, LATIN, unloadedFaces } from '../fonts.ts';

const loaded = (family: string, weight: number, status = 'loaded') => ({
  family,
  weight: String(weight),
  status,
});
const everyFace = FACES.map((f) => loaded(f.family, f.weight));

describe('unloadedFaces', () => {
  it('is empty when every face loaded', () => {
    expect(unloadedFaces(FACES, everyFace)).toEqual([]);
  });

  it('names a family the page has no face for at all', () => {
    // As when the Google Fonts stylesheet cannot be reached.
    const withoutHebrew = everyFace.filter((f) => f.family !== HEBREW);
    expect(unloadedFaces(FACES, withoutHebrew)).toEqual([{ family: HEBREW, weight: 700 }]);
  });

  it('names a face that is declared but failed to load', () => {
    const failed = everyFace.map((f) =>
      f.family === LATIN && f.weight === '600' ? { ...f, status: 'error' } : f,
    );
    expect(unloadedFaces(FACES, failed)).toEqual([{ family: LATIN, weight: 600 }]);
  });

  it('matches a family name the page reports in quotes', () => {
    const quoted = everyFace.map((f) => ({ ...f, family: `"${f.family}"` }));
    expect(unloadedFaces(FACES, quoted)).toEqual([]);
  });
});
