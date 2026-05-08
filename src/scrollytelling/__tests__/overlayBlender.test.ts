// src/scrollytelling/__tests__/overlayBlender.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeBlendedColors } from '../overlayBlender';
import { registerOverlay } from '../../overlays/registry';
import type { ResolvedStoryStop } from '../types';
import type { VerseLayout } from '../../types';
import type { Overlay } from '../../overlays/types';

const verses: VerseLayout[] = [
  { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 4 },
  { book: 'Genesis', chapter: 1, verse: 2, x: 0, y: 0, size: 4 },
];

// Stub overlay that returns multi-color stipple for the first verse
const stippleOverlay: Overlay = {
  id: 'test-stipple',
  name: 'Test Stipple',
  getVerseColor: (verse) => {
    if (verse.verse === 1) {
      // Multi-color stipple: red + blue
      return [
        [1, 0, 0],
        [0, 0, 1],
      ] as [number, number, number][];
    }
    return [0.5, 0.5, 0.5] as [number, number, number];
  },
};

describe('computeBlendedColors stipple preservation', () => {
  beforeEach(() => {
    registerOverlay(stippleOverlay);
  });

  afterEach(() => {
    // No deregister API; that's fine — registry holds it for the test session.
  });

  it('preserves stipple Color[] at rest when fromStop === toStop', () => {
    const stop: ResolvedStoryStop = {
      id: 's1',
      title: 'S',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-stipple',
    };
    const result = computeBlendedColors(stop, stop, 0, verses);

    // Verse 0 should be a Color[] (array of tuples), not a flattened single tuple
    const c0 = result[0];
    expect(Array.isArray(c0)).toBe(true);
    expect(Array.isArray((c0 as unknown[])[0])).toBe(true); // first elem is itself a tuple => Color[]
    expect(c0).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);

    // Verse 1 is a single color tuple
    const c1 = result[1];
    expect(Array.isArray(c1)).toBe(true);
    expect(typeof (c1 as unknown[])[0]).toBe('number'); // first elem is a number => single Color tuple
    expect(c1).toEqual([0.5, 0.5, 0.5]);
  });

  it('preserves stipple at t === 0 with different stops', () => {
    const fromStop: ResolvedStoryStop = {
      id: 's1',
      title: 'S1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-stipple',
    };
    const toStop: ResolvedStoryStop = {
      id: 's2',
      title: 'S2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-stipple',
    };
    const result = computeBlendedColors(fromStop, toStop, 0, verses);
    const c0 = result[0];
    expect(Array.isArray(c0)).toBe(true);
    expect(Array.isArray((c0 as unknown[])[0])).toBe(true);
    expect(c0).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('preserves stipple Color[] during in-progress transition (0 < t < 1)', () => {
    const fromStop: ResolvedStoryStop = {
      id: 's1',
      title: 'S1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-stipple',
    };
    const toStop: ResolvedStoryStop = {
      id: 's2',
      title: 'S2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-stipple',
    };
    const result = computeBlendedColors(fromStop, toStop, 0.5, verses);
    const c0 = result[0];
    // During transition between two identical stipple stops, slot-by-slot lerp
    // (red→red, blue→blue) keeps the stipple array intact.
    expect(Array.isArray(c0)).toBe(true);
    expect(Array.isArray((c0 as unknown[])[0])).toBe(true); // first elem is itself a tuple => Color[]
    expect(c0).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

});
