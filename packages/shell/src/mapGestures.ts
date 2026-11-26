// The reader's hands on the map: drags, pinches, the wheel, taps and keys,
// each reported as what it asks for, in screen pixels, and what a tap and
// Escape do. Nothing here touches the camera, the pin or the link.

import {
  type ScreenPoint,
  sameItem,
  type MapItem,
  createTouchState,
  getPinchCenter,
  getPinchDistance,
  releaseTouch,
  resetTouchState,
  trackTouch,
} from '@torahmap/engine';
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from './constants.ts';
import { DRAG_PX } from './frame.ts';
import { SHORTCUT_KEYS, onMac } from './shortcuts.ts';

/** The longest press, in ms, that still counts as a tap. */
const TAP_MS = 300;

export interface MapIntents<I extends MapItem> {
  /** A pointer went down on the map. */
  grab(): void;
  /** Move the map by a drag of (dx, dy) screen pixels. */
  pan(dx: number, dy: number): void;
  /** Zoom by `factor`, holding the point `at` still. */
  zoom(factor: number, at: ScreenPoint): void;
  /** A wheel turn, a zoom button, or a press of the map (a drag, a pinch or a tap) has finished. */
  moveEnded(): void;
  /** A mouse moved over the map, onto this square or onto none. */
  hover(square: I | null): void;
  /** The pointer left the map; the popup stays up. */
  leave(): void;
  /** A short press that did not move, on a square or on empty map. */
  tap(square: I | null): void;
  step(by: 1 | -1): void;
  /** Escape, pressed in a field such as the search box or not. */
  escape(inField: boolean): void;
  /** The browser's Find keys, taken over: opens the search box, its text selected. */
  find(): void;
  /** Find next / previous: steps to a search hit. False with no hit to go to, which leaves the key to the browser. */
  stepHit(by: 1 | -1): boolean;
  /** Opens the Go to box. False when this map has none. */
  goTo(): boolean;
}

/**
 * What Escape does: closes the menu; else, unless pressed in a field, lets go of a held comparison
 * or unpins the square; else closes the panel or story.
 */
export function escapeDoes(state: {
  menu: boolean;
  pinned: boolean;
  inField: boolean;
  comparing?: boolean;
}): 'menu' | 'release' | 'unpin' | 'close' {
  if (state.menu) return 'menu';
  if (state.comparing && !state.inField) return 'release';
  if (state.pinned && !state.inField) return 'unpin';
  return 'close';
}

/** Whether the platform's main modifier is down alone: Command on a Mac, Control elsewhere, as the browser's own keys. */
export function hasMainModifier(e: KeyboardEvent, mac: boolean): boolean {
  return (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey;
}

/** The letter a key press names; on a layout without Latin letters, such as Hebrew, the Latin letter at its place on the keyboard. */
export function shortcutLetter(e: KeyboardEvent): string {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  return /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key;
}

/** Which way an arrow key steps: forward is the way the text reads. */
export function arrowStep(key: string, direction: 'rtl' | 'ltr'): 1 | -1 | null {
  const [forward, back] =
    direction === 'rtl' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  return key === forward ? 1 : key === back ? -1 : null;
}

/**
 * What a tap does: pins a square other than the pinned one, and otherwise unpins. A square the
 * pinned one `compares` with is held for comparison first, and pinned by a second tap; a tap on
 * empty map lets go of the one `held`.
 */
export function tapDoes(
  tapped: MapItem | null,
  pinned: MapItem | null,
  held: MapItem | null = null,
  compares = false,
): 'pin' | 'unpin' | 'hold' | 'release' | null {
  if (tapped && compares && !sameItem(tapped, held)) return 'hold';
  if (!tapped && held) return 'release';
  if (tapped && !sameItem(tapped, pinned)) return 'pin';
  return pinned ? 'unpin' : null;
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
  /** Whether the cursor over this square, or over empty map, is a pointer. */
  clickable: (square: I | null) => boolean;
  direction: 'rtl' | 'ltr';
  intents: MapIntents<I>;
  /** Whether Command, not Control, is the main modifier; read from the browser when left out. */
  mac?: boolean;
}): MapGestures<I> {
  const { canvas, onMap, squareUnder, clickable, direction, intents } = options;
  const mac = options.mac ?? onMac(navigator.platform);

  const touches = createTouchState();
  // Where a press went down and when, until it is released or cancelled.
  let press: (ScreenPoint & { time: number }) | null = null;
  // Where a drag last reported, while one is under way.
  let dragFrom: ScreenPoint | null = null;
  let mouse: ScreenPoint | null = null;

  function endPress(): void {
    press = null;
    dragFrom = null;
  }

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
      }
      touches.lastPinchDistance = distance;
    },
    { passive: true },
  );

  // A pinch has ended once a finger lifts, which its pointerup reports.
  canvas.addEventListener('touchend', (e: TouchEvent) => {
    for (const t of e.changedTouches) releaseTouch(touches, t.identifier);
  });

  canvas.addEventListener('touchcancel', () => resetTouchState(touches));

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    intents.grab();
    // Only the main button drags or taps: a right-click opens the browser's menu.
    if (e.button !== 0) return;
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
    intents.hover(square);
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    if (!press) return;
    const p = onMap(e);
    const still = Math.abs(p.x - press.x) < DRAG_PX && Math.abs(p.y - press.y) < DRAG_PX;
    const quick = Date.now() - press.time < TAP_MS;
    endPress();
    intents.moveEnded();
    const square = squareUnder(p);
    if (still && quick) intents.tap(square);
    cursorOver(square);
  });

  canvas.addEventListener('pointercancel', () => {
    if (!press) return;
    endPress();
    canvas.style.cursor = 'default';
    intents.moveEnded();
  });

  canvas.addEventListener('pointerleave', () => {
    endPress();
    mouse = null;
    canvas.style.cursor = 'default';
    intents.leave();
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const inField = !!target?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    );
    if (e.key === 'Escape') return intents.escape(inField);
    if (hasMainModifier(e, mac)) {
      let taken = false;
      switch (shortcutLetter(e)) {
        case SHORTCUT_KEYS.find:
          if (!e.shiftKey) {
            intents.find();
            taken = true;
          }
          break;
        case SHORTCUT_KEYS.next:
          taken = intents.stepHit(e.shiftKey ? -1 : 1);
          break;
        case SHORTCUT_KEYS.goTo:
          taken = !e.shiftKey && intents.goTo();
          break;
      }
      if (taken) return e.preventDefault();
    }
    // A field's arrow keys are its own.
    if (inField) return;
    const by = arrowStep(e.key, direction);
    if (by) intents.step(by);
  });

  return {
    squareUnderMouse() {
      return mouse && squareUnder(mouse);
    },
  };
}
