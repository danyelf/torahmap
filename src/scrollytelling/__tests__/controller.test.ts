import { describe, it, expect } from 'vitest';
import { computeInterpolatedState } from '../controller';
import type { ResolvedStoryStop } from '../types';

const stops: ResolvedStoryStop[] = [
  { id: 'a', title: 'A', text: 'First', camera: { x: 0, y: 0, zoom: 1 }, overlay: null },
  { id: 'b', title: 'B', text: 'Second', camera: { x: 100, y: 50, zoom: 3 }, overlay: 'search', overlayParams: { q: 'test' } },
  { id: 'c', title: 'C', text: 'Third', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
];

describe('computeInterpolatedState', () => {
  // Each stop: 600px tall, viewport: 400px
  // offsets: [0, 600, 1200], heights: [600, 600, 600]
  // totalHeight: 1800
  // scrollCenters (where stop is centered in viewport):
  //   stop 0: (0 + 300) - 200 = 100
  //   stop 1: (600 + 300) - 200 = 700
  //   stop 2: (1200 + 300) - 200 = 1100
  // restZone half = 600 * 0.4 / 2 = 120
  // rest zones: [0, 220], [580, 820], [980, 1100] (clamped to maxScroll=1400)
  const offsets = [0, 600, 1200];
  const heights = [600, 600, 600];
  const totalHeight = 1800;
  const viewportHeight = 400;

  it('returns first stop in its rest zone', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, 100, 'linear', heights, viewportHeight);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[0]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('returns second stop in its rest zone', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, 700, 'linear', heights, viewportHeight);
    expect(state.fromStop).toBe(stops[1]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 100, y: 50, zoom: 3 });
  });

  it('transitions between rest zones', () => {
    // Midpoint between rest zone 0 end (220) and rest zone 1 start (580)
    const mid = (220 + 580) / 2; // 400
    const state = computeInterpolatedState(stops, offsets, totalHeight, mid, 'linear', heights, viewportHeight);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBeCloseTo(0.5);
    expect(state.camera.x).toBeCloseTo(50);
  });

  it('holds at last stop past its rest zone', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, totalHeight, 'linear', heights, viewportHeight);
    expect(state.fromStop).toBe(stops[2]);
    expect(state.t).toBe(0);
  });

  it('clamps scroll below 0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, -100, 'linear', heights, viewportHeight);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.t).toBe(0);
  });

  it('applies easing to transition', () => {
    // 25% into transition between stop 0 and 1
    const quarter = 220 + (580 - 220) * 0.25; // 310
    const eased = computeInterpolatedState(stops, offsets, totalHeight, quarter, 'ease-in-out', heights, viewportHeight);
    const linear = computeInterpolatedState(stops, offsets, totalHeight, quarter, 'linear', heights, viewportHeight);
    expect(eased.t).not.toBeCloseTo(linear.t);
  });
});
