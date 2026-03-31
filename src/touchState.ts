// Touch State module - tracks active touches for pinch-to-zoom

interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchState {
  activeTouches: Map<number, TouchPoint>;
  lastPinchDistance: number | null;
}

/**
 * Create initial touch state with no active touches.
 *
 * @returns New TouchState
 */
export function createTouchState(): TouchState {
  return {
    activeTouches: new Map(),
    lastPinchDistance: null,
  };
}

/**
 * Track a touch point by its identifier.
 * Updates position if the touch already exists.
 *
 * @param state - Touch state to update
 * @param id - Touch identifier
 * @param x - Touch X coordinate
 * @param y - Touch Y coordinate
 */
export function trackTouch(state: TouchState, id: number, x: number, y: number): void {
  state.activeTouches.set(id, { x, y });
}

/**
 * Release a touch by its identifier.
 * Resets lastPinchDistance when fewer than 2 touches remain.
 *
 * @param state - Touch state to update
 * @param id - Touch identifier to release
 */
export function releaseTouch(state: TouchState, id: number): void {
  state.activeTouches.delete(id);
  if (state.activeTouches.size < 2) {
    state.lastPinchDistance = null;
  }
}

/**
 * Compute the distance between the first two active touches.
 *
 * @param state - Touch state to read
 * @returns Distance in pixels, or null if fewer than 2 touches
 */
export function getPinchDistance(state: TouchState): number | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the midpoint between the first two active touches.
 *
 * @param state - Touch state to read
 * @returns Midpoint as TouchPoint, or null if fewer than 2 touches
 */
export function getPinchCenter(state: TouchState): TouchPoint | null {
  if (state.activeTouches.size < 2) return null;
  const [a, b] = [...state.activeTouches.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/**
 * Clear all touches and reset pinch distance.
 *
 * @param state - Touch state to reset
 */
export function resetTouchState(state: TouchState): void {
  state.activeTouches.clear();
  state.lastPinchDistance = null;
}
