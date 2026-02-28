import { describe, it, expect } from 'vitest';
import {
  createTouchState,
  trackTouch,
  releaseTouch,
  getPinchDistance,
  getPinchCenter,
  resetTouchState,
} from '../../touchState';

describe('touchState', () => {
  describe('createTouchState', () => {
    it('creates initial state with no active touches', () => {
      const state = createTouchState();
      expect(state.activeTouches).toEqual(new Map());
      expect(state.lastPinchDistance).toBe(null);
    });
  });

  describe('trackTouch', () => {
    it('stores a touch by identifier', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(state.activeTouches.get(0)).toEqual({ x: 100, y: 200 });
    });

    it('tracks multiple touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      expect(state.activeTouches.size).toBe(2);
    });

    it('updates existing touch position', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 0, 150, 250);
      expect(state.activeTouches.get(0)).toEqual({ x: 150, y: 250 });
    });
  });

  describe('releaseTouch', () => {
    it('removes a touch by identifier', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      releaseTouch(state, 0);
      expect(state.activeTouches.size).toBe(0);
    });

    it('resets lastPinchDistance when fewer than 2 touches remain', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      state.lastPinchDistance = 100;
      releaseTouch(state, 1);
      expect(state.lastPinchDistance).toBe(null);
    });
  });

  describe('getPinchDistance', () => {
    it('returns null with fewer than 2 touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(getPinchDistance(state)).toBe(null);
    });

    it('computes distance between two touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 0, 0);
      trackTouch(state, 1, 300, 400);
      expect(getPinchDistance(state)).toBeCloseTo(500);
    });
  });

  describe('getPinchCenter', () => {
    it('returns null with fewer than 2 touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      expect(getPinchCenter(state)).toBe(null);
    });

    it('computes midpoint between two touches', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      expect(getPinchCenter(state)).toEqual({ x: 200, y: 300 });
    });
  });

  describe('resetTouchState', () => {
    it('clears all touches and pinch distance', () => {
      const state = createTouchState();
      trackTouch(state, 0, 100, 200);
      trackTouch(state, 1, 300, 400);
      state.lastPinchDistance = 500;
      resetTouchState(state);
      expect(state.activeTouches.size).toBe(0);
      expect(state.lastPinchDistance).toBe(null);
    });
  });
});
