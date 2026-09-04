// src/scrollytelling/__tests__/colorBlending.test.ts
import { describe, it, expect } from 'vitest';
import { blendColorArrays } from '../colorBlending';

describe('blendColorArrays', () => {
  it('returns fromColors at t=0', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0);
    expect(result[0]).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('returns toColors at t=1', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 1);
    expect(result[0]).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('blends at t=0.5', () => {
    const from = [{ r: 1, g: 0, b: 0 }];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0.5);
    const c0 = result[0] as { r: number; g: number; b: number };
    expect(c0.r).toBeCloseTo(0.5);
    expect(c0.g).toBeCloseTo(0.5);
  });

  it('handles multi-color arrays (Color[])', () => {
    const from = [[{ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }]];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0.5);
    expect(result).toHaveLength(1);
  });

  it('lerps stipple slot-by-slot, padding short side from default color', () => {
    // Verse with [cyan] in fromStop and [cyan, orange] in toStop, at t=0.5.
    // Slot 0: cyan -> cyan = cyan unchanged.
    // Slot 1: default (0.15,0.15,0.15) -> orange, half-faded.
    const cyan = { r: 0, g: 1, b: 1 };
    const orange = { r: 1, g: 0.5, b: 0 };
    const defaultColor = { r: 0.15, g: 0.15, b: 0.15 };

    const from = [cyan];
    const to = [[cyan, orange]];
    const result = blendColorArrays(from, to, 0.5);

    expect(result).toHaveLength(1);
    const v0 = result[0];
    expect(Array.isArray(v0)).toBe(true);
    const slots = v0 as { r: number; g: number; b: number }[];
    expect(slots).toHaveLength(2);

    // Slot 0: cyan stays cyan
    expect(slots[0].r).toBeCloseTo(cyan.r);
    expect(slots[0].g).toBeCloseTo(cyan.g);
    expect(slots[0].b).toBeCloseTo(cyan.b);

    // Slot 1: lerp(default, orange, 0.5)
    expect(slots[1].r).toBeCloseTo((defaultColor.r + orange.r) / 2);
    expect(slots[1].g).toBeCloseTo((defaultColor.g + orange.g) / 2);
    expect(slots[1].b).toBeCloseTo((defaultColor.b + orange.b) / 2);
  });
});
