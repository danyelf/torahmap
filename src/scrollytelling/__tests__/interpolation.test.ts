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

  it('moves the centre in a straight line', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 3 };
    const half = lerpCamera(from, to, 0.5);
    expect(half.x).toBe(50);
    expect(half.y).toBe(25);
  });

  it('takes each doubling of zoom in the same time', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 0, y: 0, zoom: 4 };
    expect(lerpCamera(from, to, 0.5).zoom).toBeCloseTo(2, 10);
    expect(lerpCamera(from, to, 0.25).zoom).toBeCloseTo(Math.SQRT2, 10);
  });
});

describe('lerpColor', () => {
  it('blends two colors at t=0.5', () => {
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [1, 1, 1];
    const result = lerpColor(a, b, 0.5);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.5);
  });

  it('returns first color at t=0', () => {
    const a: [number, number, number] = [0.2, 0.4, 0.6];
    const b: [number, number, number] = [0.8, 0.6, 0.4];
    expect(lerpColor(a, b, 0)).toEqual(a);
  });
});
