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
    expect(result[0].r).toBeCloseTo(0.5);
    expect(result[0].g).toBeCloseTo(0.5);
  });

  it('handles multi-color arrays (Color[])', () => {
    const from = [[{ r: 1, g: 0, b: 0 }, { r: 0, g: 0, b: 1 }]];
    const to = [{ r: 0, g: 1, b: 0 }];
    const result = blendColorArrays(from, to, 0.5);
    expect(result).toHaveLength(1);
  });
});
