// src/scrollytelling/__tests__/colorBlending.test.ts
import { describe, it, expect } from 'vitest';
import { flatten, mergePictures, still } from '../colorBlending';
import type { Color } from '../../overlays/types.ts';

describe('mergePictures', () => {
  it('returns fromColors at t=0', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = mergePictures({ colors: from }, { colors: to }, 0).colors;
    expect(result[0]).toEqual([1, 0, 0]);
  });

  it('returns toColors at t=1', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = mergePictures({ colors: from }, { colors: to }, 1).colors;
    expect(result[0]).toEqual([0, 1, 0]);
  });

  it('blends at t=0.5', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = mergePictures({ colors: from }, { colors: to }, 0.5).colors;
    const c0 = result[0] as Color;
    expect(c0[0]).toBeCloseTo(0.5);
    expect(c0[1]).toBeCloseTo(0.5);
  });

  it('handles multi-color arrays (Color[])', () => {
    const from: (Color | Color[])[] = [
      [
        [1, 0, 0],
        [0, 0, 1],
      ],
    ];
    const to: (Color | Color[])[] = [[0, 1, 0]];
    const result = mergePictures({ colors: from }, { colors: to }, 0.5).colors;
    expect(result).toHaveLength(1);
  });

  it('fades a one-colour verse into its stripes from its own colour', () => {
    // [cyan] becoming [cyan, orange, red]: every stripe starts cyan, so
    // nothing flashes dark at the start of the transition.
    const cyan: Color = [0, 1, 1];
    const orange: Color = [1, 0.5, 0];
    const red: Color = [1, 0, 0];

    const slots = mergePictures({ colors: [cyan] }, { colors: [[cyan, orange, red]] }, 0.5)
      .colors[0] as Color[];

    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual(cyan);
    expect(slots[1][0]).toBeCloseTo(0.5);
    expect(slots[1][1]).toBeCloseTo(0.75);
    expect(slots[1][2]).toBeCloseTo(0.5);
    expect(slots[2][0]).toBeCloseTo(0.5);
    expect(slots[2][1]).toBeCloseTo(0.5);
    expect(slots[2][2]).toBeCloseTo(0.5);
  });

  it('spreads the shorter side over the stripes nearest its own bands', () => {
    const a: Color = [1, 0, 0];
    const b: Color = [0, 0, 1];
    const slots = mergePictures({ colors: [[a, b]] }, { colors: [[a, a, a, a]] }, 0)
      .colors[0] as Color[];
    expect(slots).toEqual([a, a, b, b]);
  });

  it('eases the size from one stop to the other', () => {
    const a: Color = [1, 0, 0];
    const b: Color = [0, 0, 1];
    expect(mergePictures({ colors: [a] }, { colors: [[a, b]] }, 0.25).growth).toEqual([0.25]);
    expect(mergePictures({ colors: [[a, b]] }, { colors: [a] }, 0.25).growth).toEqual([0.75]);
    expect(mergePictures({ colors: [[a, b]] }, { colors: [[b, a]] }, 0.25).growth).toEqual([1]);
    expect(mergePictures({ colors: [a] }, { colors: [b] }, 0.25).growth).toEqual([0]);
  });

  it('starts from the size a layer was given, not the one its stripes suggest', () => {
    // An ease that begins partway through a transition, from a verse drawn 30% grown.
    const a: Color = [1, 0, 0];
    const b: Color = [0, 0, 1];
    const partway = { colors: [[a, b]], growth: [0.3] };
    expect(mergePictures(partway, { colors: [[a, b]] }, 0).growth).toEqual([0.3]);
    expect(mergePictures(partway, { colors: [[a, b]] }, 0.5).growth![0]).toBeCloseTo(0.65);
  });
});

describe('flatten', () => {
  const a: Color = [1, 0, 0];
  const b: Color = [0, 0, 1];

  it('is the picture itself when nothing is fading', () => {
    const picture = { colors: [a] };
    expect(flatten(still(picture))).toBe(picture);
  });

  it('merges a fade in progress where it has got to', () => {
    const layer = { from: { colors: [a] }, to: { colors: [b] }, t: 0.25 };
    expect(flatten(layer)).toEqual(mergePictures(layer.from, layer.to, 0.25));
  });
});
