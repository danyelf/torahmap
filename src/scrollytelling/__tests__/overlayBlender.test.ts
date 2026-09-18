// src/scrollytelling/__tests__/overlayBlender.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeBlendedColors } from '../overlayBlender';
import { registerOverlay } from '../../overlays/registry';
import { commentaryOverlay } from '../../overlays/commentary';
import type { ResolvedStoryStop } from '../types';
import type { TanakhLayout } from '../../types';
import type { Overlay } from '../../overlays/types';

const verses: TanakhLayout[] = [
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
  colorsFor(items) {
    return items.map((item) => stippleOverlay.getVerseColor(item));
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
    const result = computeBlendedColors(stop, stop, 0, verses, null);

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
    const result = computeBlendedColors(fromStop, toStop, 0, verses, null);
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
    const result = computeBlendedColors(fromStop, toStop, 0.5, verses, null);
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

describe('story stop settings reach the overlay', () => {
  let received: Record<string, string | undefined> | null = null;

  const settingsOverlay: Overlay = {
    id: 'test-settings',
    name: 'Test Settings',
    urlParams: [{ key: 'mode', kind: 'token', allowed: ['on', 'off'] }],
    getVerseColor: () => [0.5, 0.5, 0.5] as [number, number, number],
    colorsFor(items, settings) {
      received = { ...settings };
      return items.map(() => [0.5, 0.5, 0.5] as [number, number, number]);
    },
  };

  function stopWith(overlayParams: Record<string, string>): ResolvedStoryStop {
    return {
      id: 's',
      title: 'S',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-settings',
      overlayParams,
    };
  }

  beforeEach(() => {
    registerOverlay(settingsOverlay);
    received = null;
  });

  it('passes a declared setting through', () => {
    const stop = stopWith({ mode: 'on' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({ mode: 'on' });
  });

  it('drops a value the overlay did not allow', () => {
    // Story stops are hand-written, so they are checked like any link.
    const stop = stopWith({ mode: 'sideways' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({});
  });

  it('drops a key the overlay never declared', () => {
    const stop = stopWith({ mode: 'off', nonsense: 'x' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({ mode: 'off' });
  });
});

describe('the blender evaluates without disturbing the overlay', () => {
  beforeEach(() => {
    registerOverlay(commentaryOverlay);
  });

  it('leaves the overlay showing what it showed before the blend', () => {
    commentaryOverlay.applyUrlParams?.({ category: 'Midrash' });

    const fromStop: ResolvedStoryStop = {
      id: 'a',
      title: 'A',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'commentary',
      overlayParams: { category: 'Talmud' },
    };
    const toStop: ResolvedStoryStop = {
      id: 'b',
      title: 'B',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'commentary',
      overlayParams: { category: 'Mishnah' },
    };
    computeBlendedColors(fromStop, toStop, 0.5, verses, null);

    expect(commentaryOverlay.getUrlParams?.()).toEqual({ category: 'Midrash' });
  });
});

describe('the blender memoises colours by settings', () => {
  it('calls colorsFor once per distinct settings across repeated blends, not once per call', () => {
    const colorsForSpy = vi.fn((items: TanakhLayout[]) =>
      items.map(() => [0.2, 0.2, 0.2] as [number, number, number]),
    );
    const memoOverlay: Overlay = {
      id: 'test-memo',
      name: 'Test Memo',
      urlParams: [{ key: 'mode', kind: 'token' }],
      getVerseColor: () => [0.2, 0.2, 0.2] as [number, number, number],
      colorsFor: colorsForSpy,
    };
    registerOverlay(memoOverlay);

    const fromStop: ResolvedStoryStop = {
      id: 'm1',
      title: 'M1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-memo',
      overlayParams: { mode: 'a' },
    };
    const toStop: ResolvedStoryStop = {
      id: 'm2',
      title: 'M2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-memo',
      overlayParams: { mode: 'b' },
    };

    computeBlendedColors(fromStop, toStop, 0.5, verses, null);
    computeBlendedColors(fromStop, toStop, 0.5, verses, null);

    // Two distinct settings (mode 'a' and 'b') across two blends: once each,
    // not once per call — the second blend shares both cache entries.
    expect(colorsForSpy).toHaveBeenCalledTimes(2);
  });
});

describe('the blender only skips the memo for a hover-responsive overlay', () => {
  it('recomputes a hover-responsive overlay every call, but memoises one that never reads hover', () => {
    const hoverColorsFor = vi.fn((items: TanakhLayout[]) =>
      items.map(() => [0.3, 0.3, 0.3] as [number, number, number]),
    );
    const hoverOverlay: Overlay = {
      id: 'test-hover',
      name: 'Test Hover',
      getVerseColor: () => [0.3, 0.3, 0.3] as [number, number, number],
      colorsFor: hoverColorsFor,
      setHoveredVerse: () => false,
    };
    registerOverlay(hoverOverlay);

    const noHoverColorsFor = vi.fn((items: TanakhLayout[]) =>
      items.map(() => [0.4, 0.4, 0.4] as [number, number, number]),
    );
    const noHoverOverlay: Overlay = {
      id: 'test-no-hover',
      name: 'Test No Hover',
      getVerseColor: () => [0.4, 0.4, 0.4] as [number, number, number],
      colorsFor: noHoverColorsFor,
    };
    registerOverlay(noHoverOverlay);

    const hoverStop: ResolvedStoryStop = {
      id: 'h',
      title: 'H',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-hover',
    };
    const noHoverStop: ResolvedStoryStop = {
      id: 'n',
      title: 'N',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-no-hover',
    };

    const [verseA, verseB] = verses;

    computeBlendedColors(hoverStop, hoverStop, 0, verses, verseA);
    computeBlendedColors(hoverStop, hoverStop, 0, verses, verseB);
    computeBlendedColors(noHoverStop, noHoverStop, 0, verses, verseA);
    computeBlendedColors(noHoverStop, noHoverStop, 0, verses, verseB);

    // Declares setHoveredVerse: its colours could depend on which verse is
    // hovered, so every call with a hovered verse is evaluated fresh.
    expect(hoverColorsFor).toHaveBeenCalledTimes(2);
    // Doesn't declare setHoveredVerse: hover isn't part of its cache key, so
    // the second call (same settings) hits the entry the first call made.
    expect(noHoverColorsFor).toHaveBeenCalledTimes(1);
  });
});
