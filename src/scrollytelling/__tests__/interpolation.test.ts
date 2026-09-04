// src/scrollytelling/__tests__/interpolation.test.ts
import { describe, it, expect } from 'vitest';
import { easingFunctions, lerpCamera, lerpColor } from '../interpolation';

describe('easing functions', () => {
  it('linear is identity', () => {
    expect(easingFunctions.linear(0)).toBe(0);
    expect(easingFunctions.linear(0.5)).toBe(0.5);
    expect(easingFunctions.linear(1)).toBe(1);
  });

  it('ease-in-out is 0 at 0 and 1 at 1', () => {
    expect(easingFunctions['ease-in-out'](0)).toBe(0);
    expect(easingFunctions['ease-in-out'](1)).toBe(1);
  });

  it('ease-in-out is 0.5 at 0.5', () => {
    expect(easingFunctions['ease-in-out'](0.5)).toBe(0.5);
  });

  it('ease-in starts slow', () => {
    expect(easingFunctions['ease-in'](0.25)).toBeLessThan(0.25);
  });

  it('ease-out starts fast', () => {
    expect(easingFunctions['ease-out'](0.25)).toBeGreaterThan(0.25);
  });
});

describe('lerpCamera', () => {
  it('returns from at t=0', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 0)).toEqual(from);
  });

  it('returns to at t=1', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 1)).toEqual(to);
  });

  it('interpolates at t=0.5', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    expect(lerpCamera(from, to, 0.5)).toEqual({ x: 50, y: 25, zoom: 2 });
  });
});

describe('lerpColor', () => {
  it('blends two colors at t=0.5', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 1, g: 1, b: 1 };
    const result = lerpColor(a, b, 0.5);
    expect(result.r).toBeCloseTo(0.5);
    expect(result.g).toBeCloseTo(0.5);
    expect(result.b).toBeCloseTo(0.5);
  });

  it('returns first color at t=0', () => {
    const a = { r: 0.2, g: 0.4, b: 0.6 };
    const b = { r: 0.8, g: 0.6, b: 0.4 };
    expect(lerpColor(a, b, 0)).toEqual(a);
  });
});
