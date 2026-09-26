// src/scrollytelling/__tests__/colorBlending.test.ts
import { describe, it, expect } from 'vitest';
import { blendColorArrays } from '../colorBlending';
import type { Color } from '../../overlays/types.ts';

describe('blendColorArrays', () => {
  it('returns fromColors at t=0', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 0).colors;
    expect(result[0]).toEqual([1, 0, 0]);
  });

  it('returns toColors at t=1', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 1).colors;
    expect(result[0]).toEqual([0, 1, 0]);
  });

  it('blends at t=0.5', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 0.5).colors;
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
    const result = blendColorArrays(from, to, 0.5).colors;
    expect(result).toHaveLength(1);
  });

  it('fades a one-colour verse into its stripes from its own colour', () => {
    // [cyan] becoming [cyan, orange, red]: every stripe starts cyan, so
    // nothing flashes dark at the start of the transition.
    const cyan: Color = [0, 1, 1];
    const orange: Color = [1, 0.5, 0];
    const red: Color = [1, 0, 0];

    const slots = blendColorArrays([cyan], [[cyan, orange, red]], 0.5).colors[0] as Color[];

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
    const slots = blendColorArrays([[a, b]], [[a, a, a, a]], 0).colors[0] as Color[];
    expect(slots).toEqual([a, a, b, b]);
  });

  it('eases the size from one stop to the other', () => {
    const a: Color = [1, 0, 0];
    const b: Color = [0, 0, 1];
    expect(blendColorArrays([a], [[a, b]], 0.25).growth).toEqual([0.25]);
    expect(blendColorArrays([[a, b]], [a], 0.25).growth).toEqual([0.75]);
    expect(blendColorArrays([[a, b]], [[b, a]], 0.25).growth).toEqual([1]);
    expect(blendColorArrays([a], [b], 0.25).growth).toEqual([0]);
  });
});
