// src/scrollytelling/__tests__/controller.test.ts
import { describe, it, expect } from 'vitest';
import { computeInterpolatedState } from '../controller';
import type { StoryStop } from '../types';

const stops: StoryStop[] = [
  { id: 'a', title: 'A', text: 'First', camera: { x: 0, y: 0, zoom: 1 }, overlay: null },
  { id: 'b', title: 'B', text: 'Second', camera: { x: 100, y: 50, zoom: 3 }, overlay: 'search', overlayParams: { q: 'test' } },
  { id: 'c', title: 'C', text: 'Third', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
];

// stopOffsets: cumulative top positions of each stop's text block
// e.g., [0, 500, 1000] means stop 0 starts at 0, stop 1 at 500, stop 2 at 1000
// total scrollable height = 1500

describe('computeInterpolatedState', () => {
  const offsets = [0, 500, 1000];
  const totalHeight = 1500;

  it('returns first stop state at scroll=0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, 0);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[0]);
    expect(state.t).toBe(0);
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('returns last stop state at scroll=totalHeight', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, totalHeight);
    expect(state.fromStop).toBe(stops[2]);
    expect(state.toStop).toBe(stops[2]);
    expect(state.t).toBe(0);
  });

  it('interpolates between stops at midpoint', () => {
    // scrollTop=250 is halfway between stop 0 (offset 0) and stop 1 (offset 500)
    const state = computeInterpolatedState(stops, offsets, totalHeight, 250);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.toStop).toBe(stops[1]);
    expect(state.t).toBeCloseTo(0.5);
    expect(state.camera.x).toBeCloseTo(50);
  });

  it('clamps scroll below 0', () => {
    const state = computeInterpolatedState(stops, offsets, totalHeight, -100);
    expect(state.fromStop).toBe(stops[0]);
    expect(state.t).toBe(0);
  });
});
