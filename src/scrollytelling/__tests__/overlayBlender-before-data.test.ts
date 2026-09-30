// The search's data is never loaded in this file.
import { describe, it, expect } from 'vitest';
import { pictureForStop } from '../overlayBlender';
import type { ResolvedStoryStop } from '../types';
import type { TanakhLayout } from '../../types';

const verses: TanakhLayout[] = [
  { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 4 },
  { book: 'Genesis', chapter: 1, verse: 2, x: 0, y: 0, size: 4 },
];

describe('a stop that does not search, before the search’s data arrives', () => {
  it('keeps its picture rather than drawing it again every frame', () => {
    const stop: ResolvedStoryStop = {
      id: 'plain',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: null,
    };
    expect(pictureForStop(stop, verses, null)).toBe(pictureForStop(stop, verses, null));
  });
});
