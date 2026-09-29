// src/scrollytelling/__tests__/overlayBlender.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pictureForStop, computeBlendedColors } from '../overlayBlender';
import { registerOverlay } from '../../overlays/registry';
import { commentaryOverlay } from '../../overlays/commentary';
import { createOverlaySettings } from '../../overlays/settings';
import type { ResolvedStoryStop } from '../types';
import type { TanakhLayout } from '../../types';
import type { Overlay, UrlParamValues } from '../../overlays/types';
import { buildSearchIndex } from '../../search';
import { SAMPLE_VERSE_TEXTS } from '../../__tests__/helpers/fixtures';
import { SEARCH_COLORS } from '../../utils/color';
import { DIMMED_GREY, SEARCH_WITH_OVERLAY } from '../../constants';

// The blender memoises per verses array, so a fresh one keeps each test's
// colours its own.
let verses: TanakhLayout[];
beforeEach(() => {
  verses = [
    { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 4 },
    { book: 'Genesis', chapter: 1, verse: 2, x: 0, y: 0, size: 4 },
  ];
});

// Stub overlay that returns several colors for the first verse
const multiColorOverlay: Overlay = {
  id: 'test-multi-color',
  name: 'Test Multi-color',
  getVerseColor: (verse) => {
    if (verse.verse === 1) {
      // Multi-color: red + blue
      return [
        [1, 0, 0],
        [0, 0, 1],
      ] as [number, number, number][];
    }
    return [0.5, 0.5, 0.5] as [number, number, number];
  },
  colorsFor(items, settings) {
    return items.map((item) => multiColorOverlay.getVerseColor(item, settings));
  },
};

describe('computeBlendedColors multi-color preservation', () => {
  beforeEach(() => {
    registerOverlay(multiColorOverlay);
  });

  afterEach(() => {
    // No deregister API; that's fine — registry holds it for the test session.
  });

  it('preserves multi-color Color[] at rest when fromStop === toStop', () => {
    const stop: ResolvedStoryStop = {
      id: 's1',
      title: 'S',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };
    const result = computeBlendedColors(stop, stop, 0, verses, null).from.colors;

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

  it('preserves multi-color at t === 0 with different stops', () => {
    const fromStop: ResolvedStoryStop = {
      id: 's1',
      title: 'S1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };
    const toStop: ResolvedStoryStop = {
      id: 's2',
      title: 'S2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };
    const result = computeBlendedColors(fromStop, toStop, 0, verses, null).from.colors;
    const c0 = result[0];
    expect(Array.isArray(c0)).toBe(true);
    expect(Array.isArray((c0 as unknown[])[0])).toBe(true);
    expect(c0).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('hands both stops their own colours to fade between mid-transition (0 < t < 1)', () => {
    const fromStop: ResolvedStoryStop = {
      id: 's1',
      title: 'S1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };
    const toStop: ResolvedStoryStop = {
      id: 's2',
      title: 'S2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };
    const layer = computeBlendedColors(fromStop, toStop, 0.5, verses, null);
    const stripes = [
      [1, 0, 0],
      [0, 0, 1],
    ];
    expect(layer.from.colors[0]).toEqual(stripes);
    expect(layer.to?.colors[0]).toEqual(stripes);
    expect(layer.t).toBe(0.5);
  });
});

describe('story stop settings reach the overlay', () => {
  let received: Record<string, string | undefined> | null = null;

  const settingsOverlay: Overlay = {
    id: 'test-settings',
    name: 'Test Settings',
    urlParams: [{ key: 'state', kind: 'token', allowed: ['on', 'off'] }],
    settingsFromUrl: (params) => params,
    settingsToUrl: () => ({}),
    getVerseColor: () => [0.5, 0.5, 0.5] as [number, number, number],
    colorsFor(items, settings: UrlParamValues) {
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
    const stop = stopWith({ state: 'on' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({ state: 'on' });
  });

  it('drops a value the overlay did not allow', () => {
    // Story stops are hand-written, so they are checked like any link.
    const stop = stopWith({ state: 'sideways' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({});
  });

  it('drops a key the overlay never declared', () => {
    const stop = stopWith({ state: 'off', nonsense: 'x' });
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(received).toEqual({ state: 'off' });
  });

  it("hands an overlay with its own settings type the settings it builds from the stop's", () => {
    let handed: unknown = null;
    const typedOverlay: Overlay<TanakhLayout, { on: boolean }> = {
      id: 'test-typed-settings',
      name: 'Test Typed Settings',
      urlParams: [{ key: 'state', kind: 'token', allowed: ['on', 'off'] }],
      settingsFromUrl: (params) => ({ on: params.state === 'on' }),
      settingsToUrl: () => ({}),
      getVerseColor: () => [0.5, 0.5, 0.5] as [number, number, number],
      colorsFor(items, settings) {
        handed = settings;
        return items.map(() => [0.5, 0.5, 0.5] as [number, number, number]);
      },
    };
    registerOverlay(typedOverlay);

    const stop = { ...stopWith({ state: 'on' }), overlay: 'test-typed-settings' };
    computeBlendedColors(stop, stop, 0, verses, null);
    expect(handed).toEqual({ on: true });
  });
});

describe('the blender evaluates without disturbing the overlay', () => {
  beforeEach(() => {
    registerOverlay(commentaryOverlay);
  });

  it("a blend leaves Commentary's colours for the held settings unchanged", () => {
    // The overlay holds no settings of its own; the app does, and the blend
    // reads only each stop's own settings, never the app's — so what the app
    // holds cannot be touched, by construction. What this guards is the
    // shared per-category memo: blending two other categories must not leave
    // it painting the held one differently.
    const settings = createOverlaySettings();
    settings.restore(commentaryOverlay, { category: 'Midrash' });
    const held = settings.get(commentaryOverlay);
    const verse = verses[0];
    const before = commentaryOverlay.getVerseColor(verse, held);

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

    expect(commentaryOverlay.getVerseColor(verse, settings.get(commentaryOverlay))).toEqual(before);
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
      urlParams: [{ key: 'state', kind: 'token' }],
      settingsFromUrl: (params) => params,
      settingsToUrl: () => ({}),
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
      overlayParams: { state: 'a' },
    };
    const toStop: ResolvedStoryStop = {
      id: 'm2',
      title: 'M2',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-memo',
      overlayParams: { state: 'b' },
    };

    computeBlendedColors(fromStop, toStop, 0.5, verses, null);
    computeBlendedColors(fromStop, toStop, 0.5, verses, null);

    // Two distinct settings (state 'a' and 'b') across two blends: once each,
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
      hoverChangesColors: () => false,
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

    // Declares hoverChangesColors: its colours could depend on which verse is
    // hovered, so every call with a hovered verse is evaluated fresh.
    expect(hoverColorsFor).toHaveBeenCalledTimes(2);
    // Doesn't declare hoverChangesColors: hover isn't part of its cache key, so
    // the second call (same settings) hits the entry the first call made.
    expect(noHoverColorsFor).toHaveBeenCalledTimes(1);
  });
});

describe('pictureForStop', () => {
  it('gives a stop the same colours whether asked directly or as a zero blend', () => {
    registerOverlay(multiColorOverlay);
    const stop: ResolvedStoryStop = {
      id: 's1',
      text: '',
      camera: { x: 0, y: 0, zoom: 1 },
      overlay: 'test-multi-color',
    };

    expect(pictureForStop(stop, verses, null)).toEqual(
      computeBlendedColors(stop, stop, 0, verses, null).from,
    );
  });
});

describe('a stop that searches', () => {
  const grey = DIMMED_GREY[0];
  const DIM = SEARCH_WITH_OVERLAY.NON_MATCH_DIM;

  beforeEach(() => {
    buildSearchIndex(SAMPLE_VERSE_TEXTS);
    registerOverlay(multiColorOverlay);
  });

  function stopWith(extra: Partial<ResolvedStoryStop>): ResolvedStoryStop {
    return { id: 'search', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: null, ...extra };
  }

  it('fills its matches and dims the rest, as search alone always has', () => {
    // "God" is in Genesis 1:1 and not 1:2.
    const picture = pictureForStop(stopWith({ searchParams: { search: 'God' } }), verses, null);

    expect(picture.colors[0]).toEqual(SEARCH_COLORS[0]);
    expect(picture.colors[1]).toEqual([grey, grey, grey]);
    expect(picture.rings).toBeUndefined();
  });

  it('rings its matches over its overlay and dims the rest', () => {
    const stop = stopWith({ overlay: 'test-multi-color', searchParams: { search: 'God' } });
    const picture = pictureForStop(stop, verses, null);

    expect(picture.colors[0]).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ]);
    expect(picture.rings![0]).toEqual(SEARCH_COLORS[0]);
    expect(picture.colors[1]).toEqual([0.5 * DIM, 0.5 * DIM, 0.5 * DIM]);
    expect(picture.rings![1]).toBeNull();
  });

  it('keeps apart stops that differ only in their search', () => {
    const god = stopWith({ overlay: 'test-multi-color', searchParams: { search: 'God' } });
    const earth = { ...god, id: 'earth', searchParams: { search: 'earth' } };
    expect(pictureForStop(god, verses, null)).not.toEqual(pictureForStop(earth, verses, null));
  });
});
