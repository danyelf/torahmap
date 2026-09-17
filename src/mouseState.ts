// Mouse State module - handles mouse interaction state

import type { TanakhLayout } from './types';

export interface MouseState {
  isDragging: boolean;
  hoveredVerse: TanakhLayout | null;
  dragStart: { x: number; y: number };
}

export function createMouseState(): MouseState {
  return {
    isDragging: false,
    hoveredVerse: null,
    dragStart: { x: 0, y: 0 },
  };
}

export function startDrag(state: MouseState, x: number, y: number): void {
  state.isDragging = true;
  state.dragStart = { x, y };
}

export function stopDrag(state: MouseState): void {
  state.isDragging = false;
}

export function setHoveredVerse(state: MouseState, verse: TanakhLayout | null): void {
  state.hoveredVerse = verse;
}

/** Clears hover and drag state, e.g. when the mouse leaves the canvas. */
export function clearHover(state: MouseState): void {
  state.isDragging = false;
  state.hoveredVerse = null;
}
