// Mouse State module - handles mouse interaction state

import type { TanakhLayout } from './types';

/**
 * Mouse interaction state
 */
export interface MouseState {
  isDragging: boolean;
  hoveredVerse: TanakhLayout | null;
  dragStart: { x: number; y: number };
}

/**
 * Create initial mouse state.
 *
 * @returns New MouseState with no interaction
 */
export function createMouseState(): MouseState {
  return {
    isDragging: false,
    hoveredVerse: null,
    dragStart: { x: 0, y: 0 },
  };
}

/**
 * Start drag operation - record starting position.
 *
 * @param state - Mouse state to update
 * @param x - Starting X coordinate
 * @param y - Starting Y coordinate
 */
export function startDrag(state: MouseState, x: number, y: number): void {
  state.isDragging = true;
  state.dragStart = { x, y };
}

/**
 * Stop drag operation.
 *
 * @param state - Mouse state to update
 */
export function stopDrag(state: MouseState): void {
  state.isDragging = false;
}

/**
 * Update hovered verse.
 *
 * @param state - Mouse state to update
 * @param verse - Verse under mouse (or null)
 */
export function setHoveredVerse(state: MouseState, verse: TanakhLayout | null): void {
  state.hoveredVerse = verse;
}

/**
 * Clear all hover and drag state (e.g., when mouse leaves canvas).
 *
 * @param state - Mouse state to update
 */
export function clearHover(state: MouseState): void {
  state.isDragging = false;
  state.hoveredVerse = null;
}
