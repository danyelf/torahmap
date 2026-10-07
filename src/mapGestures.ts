// The reader's hands on the map: drags, pinches, the wheel, taps and keys,
// each reported as what it asks for, in screen pixels. The shell answers by
// its own rules; nothing here touches the camera, the pin or the link.

import type { ScreenPoint } from './camera.ts';
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from './constants.ts';
import { DRAG_PX } from './frame.ts';
import type { MapItem } from './types.ts';
import {
  createTouchState,
  getPinchCenter,
  getPinchDistance,
  releaseTouch,
  resetTouchState,
  trackTouch,
} from './touchState.ts';

/** The longest press, in ms, that still counts as a tap. */
const TAP_MS = 300;

export interface MapIntents<I extends MapItem> {
  /** A pointer went down on the map. */
  grab(): void;
  /** Move the map by a drag of (dx, dy) screen pixels. */
  pan(dx: number, dy: number): void;
  /** Zoom by `factor`, holding the point `at` still. */
  zoom(factor: number, at: ScreenPoint): void;
  /** A wheel turn, button press, drag or pinch has finished. */
  moveEnded(): void;
  /** A mouse moved onto another square, or off every square. */
  hover(square: I | null): void;
  /** The pointer left the map. Unlike hovering off every square, this leaves the popup up, so the reader can reach it. */
  leave(): void;
  /** A short press that did not move, on a square or on empty map. */
  tap(square: I | null): void;
  /** ArrowRight or ArrowLeft. */
  step(by: 1 | -1): void;
  /** Escape. */
  escape(): void;
}

export interface MapGestures<I extends MapItem> {
  /** The square under the mouse's last position, for when the map moves under a still cursor. */
  squareUnderMouse(): I | null;
}

export function createMapGestures<I extends MapItem>(options: {
  canvas: HTMLCanvasElement;
  zoomIn: HTMLElement | null;
  zoomOut: HTMLElement | null;
  onMap: (e: { clientX: number; clientY: number }) => ScreenPoint;
  squareUnder: (p: ScreenPoint) => I | null;
  /** Whether a click on this square, or on empty map, would do something worth a pointing cursor. */
  clickable: (square: I | null) => boolean;
  intents: MapIntents<I>;
}): MapGestures<I> {
  const { canvas, onMap, squareUnder, clickable, intents } = options;

  const touches = createTouchState();
  let pinched = false;
  // Where a press went down and when, until it is released or cancelled.
  let press: (ScreenPoint & { time: number }) | null = null;
  // Where a drag last reported, while one is under way.
  let dragFrom: ScreenPoint | null = null;
  let mouse: ScreenPoint | null = null;
  let hovered: I | null = null;

  const sameSquare = (a: I | null, b: I | null): boolean => (a?.id ?? null) === (b?.id ?? null);

  function cursorOver(square: I | null): void {
    canvas.style.cursor = clickable(square) ? 'pointer' : 'default';
  }

  function zoomButton(button: HTMLElement | null, factor: number): void {
    button?.addEventListener('click', () => {
      intents.zoom(factor, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
      intents.moveEnded();
    });
  }
  zoomButton(options.zoomIn, ZOOM_IN_FACTOR);
  zoomButton(options.zoomOut, ZOOM_OUT_FACTOR);

  canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      intents.zoom(e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR, onMap(e));
      intents.moveEnded();
    },
    { passive: false },
  );

  canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      for (const t of e.changedTouches) {
        const p = onMap(t);
        trackTouch(touches, t.identifier, p.x, p.y);
      }
      if (touches.activeTouches.size === 2) touches.lastPinchDistance = getPinchDistance(touches);
    },
    { passive: true },
  );

  canvas.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      for (const t of e.changedTouches) {
        const p = onMap(t);
        trackTouch(touches, t.identifier, p.x, p.y);
      }
      if (touches.activeTouches.size < 2) return;
      const distance = getPinchDistance(touches);
      const centre = getPinchCenter(touches);
      if (distance && centre && touches.lastPinchDistance) {
        intents.zoom(distance / touches.lastPinchDistance, centre);
        pinched = true;
      }
      touches.lastPinchDistance = distance;
    },
    { passive: true },
  );

  canvas.addEventListener('touchend', (e: TouchEvent) => {
    for (const t of e.changedTouches) releaseTouch(touches, t.identifier);
    if (touches.activeTouches.size === 0 && pinched) {
      pinched = false;
      intents.moveEnded();
    }
  });

  canvas.addEventListener('touchcancel', () => {
    resetTouchState(touches);
    pinched = false;
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    // Only the main button: a right-click opens the browser's menu.
    if (e.button !== 0) return;
    intents.grab();
    const p = onMap(e);
    dragFrom = p;
    press = { ...p, time: Date.now() };
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (touches.activeTouches.size >= 2) return;
    const p = onMap(e);
    if (dragFrom) {
      const dx = p.x - dragFrom.x;
      const dy = p.y - dragFrom.y;
      if (dx !== 0 || dy !== 0) intents.pan(dx, dy);
      dragFrom = p;
      return;
    }
    if (e.pointerType === 'touch') return;
    mouse = p;
    const square = squareUnder(p);
    cursorOver(square);
    if (sameSquare(square, hovered)) return;
    hovered = square;
    intents.hover(square);
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    if (!press) return;
    const p = onMap(e);
    const still = Math.abs(p.x - press.x) < DRAG_PX && Math.abs(p.y - press.y) < DRAG_PX;
    const quick = Date.now() - press.time < TAP_MS;
    press = null;
    dragFrom = null;
    intents.moveEnded();
    if (still && quick) intents.tap(squareUnder(p));
    cursorOver(squareUnder(p));
  });

  canvas.addEventListener('pointercancel', () => {
    if (!press) return;
    press = null;
    dragFrom = null;
    canvas.style.cursor = 'default';
    intents.moveEnded();
  });

  canvas.addEventListener('pointerleave', () => {
    press = null;
    dragFrom = null;
    mouse = null;
    hovered = null;
    canvas.style.cursor = 'default';
    intents.leave();
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Keys typed into a field are the field's.
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape') intents.escape();
    else if (e.key === 'ArrowRight') intents.step(1);
    else if (e.key === 'ArrowLeft') intents.step(-1);
  });

  return {
    squareUnderMouse() {
      hovered = mouse && squareUnder(mouse);
      return hovered;
    },
  };
}
