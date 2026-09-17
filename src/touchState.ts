// Touch State module - tracks active touches for pinch-to-zoom

interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchState {
  activeTouches: Map<number, TouchPoint>;
  lastPinchDistance: number | null;
}

export function createTouchState(): TouchState {
  return {
    activeTouches: new Map(),
    lastPinchDistance: null,
  };
}

export function trackTouch(state: TouchState, id: number, x: number, y: number): void {
  state.activeTouches.set(id, { x, y });
}

/** Releases a touch by id, resetting lastPinchDistance once fewer than 2 remain. */
export function releaseTouch(state: TouchState, id: number): void {
  state.activeTouches.delete(id);
  if (state.activeTouches.size < 2) {
    state.lastPinchDistance = null;
  }
}

export function getPinchDistance(state: TouchState): number | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getPinchCenter(state: TouchState): TouchPoint | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function resetTouchState(state: TouchState): void {
  state.activeTouches.clear();
  state.lastPinchDistance = null;
}
