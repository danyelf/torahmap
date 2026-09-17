// src/scrollytelling/__tests__/colorBlending.test.ts
import { describe, it, expect } from 'vitest';
import { blendColorArrays } from '../colorBlending';
import type { Color } from '../../overlays/types.ts';

describe('blendColorArrays', () => {
  it('returns fromColors at t=0', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 0);
    expect(result[0]).toEqual([1, 0, 0]);
  });

  it('returns toColors at t=1', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 1);
    expect(result[0]).toEqual([0, 1, 0]);
  });

  it('blends at t=0.5', () => {
    const from: Color[] = [[1, 0, 0]];
    const to: Color[] = [[0, 1, 0]];
    const result = blendColorArrays(from, to, 0.5);
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
    const result = blendColorArrays(from, to, 0.5);
    expect(result).toHaveLength(1);
  });

  it('lerps stipple slot-by-slot, padding short side from default color', () => {
    // Verse with [cyan] in fromStop and [cyan, orange] in toStop, at t=0.5.
    // Slot 0: cyan -> cyan = cyan unchanged.
    // Slot 1: default (0.15,0.15,0.15) -> orange, half-faded.
    const cyan: Color = [0, 1, 1];
    const orange: Color = [1, 0.5, 0];
    const defaultColor: Color = [0.15, 0.15, 0.15];

    const from: (Color | Color[])[] = [cyan];
    const to: (Color | Color[])[] = [[cyan, orange]];
    const result = blendColorArrays(from, to, 0.5);

    expect(result).toHaveLength(1);
    const v0 = result[0];
    expect(Array.isArray(v0)).toBe(true);
    const slots = v0 as Color[];
    expect(slots).toHaveLength(2);

    // Slot 0: cyan stays cyan
    expect(slots[0][0]).toBeCloseTo(cyan[0]);
    expect(slots[0][1]).toBeCloseTo(cyan[1]);
    expect(slots[0][2]).toBeCloseTo(cyan[2]);

    // Slot 1: lerp(default, orange, 0.5)
    expect(slots[1][0]).toBeCloseTo((defaultColor[0] + orange[0]) / 2);
    expect(slots[1][1]).toBeCloseTo((defaultColor[1] + orange[1]) / 2);
    expect(slots[1][2]).toBeCloseTo((defaultColor[2] + orange[2]) / 2);
  });
});
