// src/scrollytelling/__tests__/controller.test.ts
import { describe, it, expect } from 'vitest';
import { computeInterpolatedState } from '../controller';
import type { ResolvedStoryStop } from '../types';

const stops: ResolvedStoryStop[] = [
  { id: 'a', title: 'A', text: 'First', camera: { x: 0, y: 0, zoom: 1 }, overlay: null },
  { id: 'b', title: 'B', text: 'Second', camera: { x: 100, y: 50, zoom: 3 }, overlay: 'search', overlayParams: { q: 'test' } },
  { id: 'c', title: 'C', text: 'Third', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
];

describe('computeInterpolatedState', () => {
  // Each stop element is 500px tall, starting at offsets 0, 500, 1000
  const offsets = [0, 500, 1000];
  const heights = [500, 500, 500];
  const totalHeight = 1500;

  it('returns first stop state in its rest zone', () => {
    // Center of first stop is at 250, rest zone is 250 ± 100 = [150, 350]
    const state = computeInterpolatedState(stops, offsets, totalHeight, 250, 'linear', heights);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[0]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('returns second stop state in its rest zone', () => {
    // Center of second stop is at 750, rest zone is [650, 850]
    const state = computeInterpolatedState(stops, offsets, totalHeight, 750, 'linear', heights);
    expect(state.fromStop).toBe(stops[1]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 100, y: 50, zoom: 3 });
  });

  it('transitions between rest zones', () => {
    // Rest zone of stop 0 ends at 350, rest zone of stop 1 starts at 650
    // Midpoint of transition: 500
    const state = computeInterpolatedState(stops, offsets, totalHeight, 500, 'linear', heights);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBeCloseTo(0.5);
    expect(state.camera.x).toBeCloseTo(50);
  });

  it('holds at last stop past its rest zone', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, totalHeight, 'linear', heights);
    expect(state.fromStop).toBe(stops[2]);
    expect(state.t).toBe(0);
  });

  it('clamps scroll below 0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, -100, 'linear', heights);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.t).toBe(0);
  });

  it('applies easing to transition', () => {
    // Midpoint with ease-in-out should still be ~0.5
    const state = computeInterpolatedState(stops, offsets, totalHeight, 500, 'ease-in-out', heights);
    expect(state.t).toBeCloseTo(0.5);
    // But at 25% of transition, ease-in-out should differ from linear
    const quarter = 350 + (650 - 350) * 0.25; // 425
    const eased = computeInterpolatedState(stops, offsets, totalHeight, quarter, 'ease-in-out', heights);
    const linear = computeInterpolatedState(stops, offsets, totalHeight, quarter, 'linear', heights);
    expect(eased.t).not.toBeCloseTo(linear.t);
  });
});
