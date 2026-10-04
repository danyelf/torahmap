// Mouse State module - handles mouse interaction state

import type { MapItem } from './types';

export interface MouseState<I extends MapItem> {
  isDragging: boolean;
  hoveredVerse: I | null;
  dragStart: { x: number; y: number };
}

export function createMouseState<I extends MapItem>(): MouseState<I> {
  return {
    isDragging: false,
    hoveredVerse: null,
    dragStart: { x: 0, y: 0 },
  };
}

export function startDrag<I extends MapItem>(state: MouseState<I>, x: number, y: number): void {
  state.isDragging = true;
  state.dragStart = { x, y };
}

export function stopDrag<I extends MapItem>(state: MouseState<I>): void {
  state.isDragging = false;
}

export function setHoveredVerse<I extends MapItem>(state: MouseState<I>, verse: I | null): void {
  state.hoveredVerse = verse;
}

/** Clears hover and drag state, e.g. when the mouse leaves the canvas. */
export function clearHover<I extends MapItem>(state: MouseState<I>): void {
  state.isDragging = false;
  state.hoveredVerse = null;
}
