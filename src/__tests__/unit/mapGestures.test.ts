// The reader's hands on the map, turned into intents. The map is a grid of
// 10-pixel squares, each named by its column and row; a square is pinned when
// `pinned` names it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapGestures, type MapGestures } from '../../mapGestures';
import { DRAG_PX } from '../../frame';
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from '../../constants';
import type { MapItem } from '../../types';

type Square = MapItem & { id: string };

const CELL = 10;
const squareAt = (x: number, y: number): Square | null =>
  x < 0 || y < 0 ? null : ({ id: `${Math.floor(x / CELL)},${Math.floor(y / CELL)}` } as Square);

let canvas: HTMLCanvasElement;
let zoomIn: HTMLButtonElement;
let zoomOut: HTMLButtonElement;
let heard: string[];
let pinned: Square | null;
let gestures: MapGestures<Square>;

const id = (square: Square | null): string => square?.id ?? 'none';

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}): void {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      ...init,
    }),
  );
}

function touch(type: string, touches: { id: number; x: number; y: number }[]): void {
  const changedTouches = touches.map((t) => ({ identifier: t.id, clientX: t.x, clientY: t.y }));
  canvas.dispatchEvent(new TouchEvent(type, { changedTouches } as unknown as TouchEventInit));
}

beforeEach(() => {
  vi.useFakeTimers();
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 200 });
  Object.defineProperty(canvas, 'clientHeight', { value: 100 });
  canvas.setPointerCapture = () => {};
  zoomIn = document.createElement('button');
  zoomOut = document.createElement('button');
  document.body.append(canvas, zoomIn, zoomOut);
  // Each test's gestures write to their own list: the key listeners of earlier ones are still on the window.
  const log: string[] = [];
  heard = log;
  pinned = null;
  gestures = createMapGestures<Square>({
    canvas,
    zoomIn,
    zoomOut,
    onMap: (e) => ({ x: e.clientX, y: e.clientY }),
    squareUnder: (p) => squareAt(p.x, p.y),
    clickable: (square) => pinned !== null && square !== null,
    intents: {
      grab: () => log.push('grab'),
      pan: (dx, dy) => log.push(`pan ${dx} ${dy}`),
      zoom: (factor, at) => log.push(`zoom ${factor.toFixed(2)} at ${at.x},${at.y}`),
      moveEnded: () => log.push('moveEnded'),
      hover: (square) => log.push(`hover ${id(square)}`),
      leave: () => log.push('leave'),
      tap: (square) => log.push(`tap ${id(square)}`),
      step: (by) => log.push(`step ${by}`),
      escape: () => log.push('escape'),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a tap', () => {
  it('is a press and release in place, on the square under it', () => {
    pointer('pointerdown', 15, 25);
    pointer('pointerup', 16, 25);
    expect(heard).toEqual(['grab', 'moveEnded', 'tap 1,2']);
  });

  it('on empty map is a tap on nothing', () => {
    pointer('pointerdown', -5, 5);
    pointer('pointerup', -5, 5);
    expect(heard).toContain('tap none');
  });

  it('is not a press that moves as far as a drag', () => {
    pointer('pointerdown', 15, 25);
    pointer('pointerup', 15 + DRAG_PX, 25);
    expect(heard.some((h) => h.startsWith('tap'))).toBe(false);
  });

  it('is not a press held too long', () => {
    pointer('pointerdown', 15, 25);
    vi.advanceTimersByTime(400);
    pointer('pointerup', 15, 25);
    expect(heard.some((h) => h.startsWith('tap'))).toBe(false);
  });

  it('is not a right-click', () => {
    pointer('pointerdown', 15, 25, { button: 2 });
    pointer('pointerup', 15, 25, { button: 2 });
    expect(heard).toEqual([]);
  });

  it('is not a press the browser cancelled', () => {
    pointer('pointerdown', 15, 25);
    pointer('pointercancel', 15, 25);
    pointer('pointerup', 15, 25);
    expect(heard).toEqual(['grab', 'moveEnded']);
  });
});

describe('a drag', () => {
  it('pans by the pixels moved, and ends when released', () => {
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 60, 45);
    pointer('pointermove', 60, 45);
    pointer('pointermove', 70, 45);
    pointer('pointerup', 70, 45);
    expect(heard).toEqual(['grab', 'pan 10 -5', 'pan 10 0', 'moveEnded']);
  });

  it('stops panning when the browser cancels it', () => {
    pointer('pointerdown', 50, 50);
    pointer('pointercancel', 50, 50);
    pointer('pointermove', 60, 50, { pointerType: 'touch' });
    expect(heard).toEqual(['grab', 'moveEnded']);
  });

  it('leaves a pointing cursor over a square that a click would do something to', () => {
    pinned = squareAt(0, 0);
    pointer('pointerdown', 50, 50);
    expect(canvas.style.cursor).toBe('grabbing');
    pointer('pointerup', 80, 50);
    expect(canvas.style.cursor).toBe('pointer');
  });
});

describe('a pinch', () => {
  it('zooms by the change in distance around the fingers’ midpoint, without panning', () => {
    touch('touchstart', [
      { id: 1, x: 40, y: 50 },
      { id: 2, x: 60, y: 50 },
    ]);
    pointer('pointerdown', 40, 50, { pointerType: 'touch' });
    touch('touchmove', [{ id: 2, x: 80, y: 50 }]);
    pointer('pointermove', 30, 50, { pointerType: 'touch' });
    expect(heard).toEqual(['grab', 'zoom 2.00 at 60,50']);
  });

  it('has ended only when both fingers lift', () => {
    touch('touchstart', [
      { id: 1, x: 40, y: 50 },
      { id: 2, x: 60, y: 50 },
    ]);
    touch('touchmove', [{ id: 2, x: 80, y: 50 }]);
    touch('touchend', [{ id: 1, x: 40, y: 50 }]);
    expect(heard).not.toContain('moveEnded');
    touch('touchend', [{ id: 2, x: 80, y: 50 }]);
    expect(heard).toContain('moveEnded');
  });

  it('forgets its fingers when the browser cancels the touch', () => {
    touch('touchstart', [
      { id: 1, x: 40, y: 50 },
      { id: 2, x: 60, y: 50 },
    ]);
    touch('touchcancel', []);
    touch('touchstart', [{ id: 3, x: 10, y: 10 }]);
    touch('touchmove', [{ id: 3, x: 20, y: 10 }]);
    expect(heard.some((h) => h.startsWith('zoom'))).toBe(false);
  });
});

describe('zooming', () => {
  it('turns the wheel one step at the cursor, keeping the page from scrolling', () => {
    const wheel = new WheelEvent('wheel', { deltaY: -3, cancelable: true });
    // happy-dom's WheelEvent drops the pointer's position from its init.
    Object.assign(wheel, { clientX: 30, clientY: 40 });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(heard).toEqual([`zoom ${ZOOM_IN_FACTOR.toFixed(2)} at 30,40`, 'moveEnded']);
  });

  it('zooms from the buttons around the middle of the map', () => {
    zoomOut.click();
    expect(heard).toEqual([`zoom ${ZOOM_OUT_FACTOR.toFixed(2)} at 100,50`, 'moveEnded']);
  });
});

describe('the mouse over the map', () => {
  it('says when it moves onto another square, and only then', () => {
    pointer('pointermove', 1, 1);
    pointer('pointermove', 2, 2);
    pointer('pointermove', 12, 2);
    pointer('pointermove', -1, 2);
    expect(heard).toEqual(['hover 0,0', 'hover 1,0', 'hover none']);
  });

  it('hovers nothing with a finger', () => {
    pointer('pointermove', 1, 1, { pointerType: 'touch' });
    expect(heard).toEqual([]);
  });

  it('says it left, and is over nothing afterwards', () => {
    pointer('pointermove', 1, 1);
    expect(id(gestures.squareUnderMouse())).toBe('0,0');
    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    expect(heard).toEqual(['hover 0,0', 'leave']);
    expect(gestures.squareUnderMouse()).toBeNull();
  });
});

describe('the keys', () => {
  const key = (k: string, target: EventTarget = document.body): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  };

  it('step and escape', () => {
    key('ArrowRight');
    key('ArrowLeft');
    key('Escape');
    expect(heard).toEqual(['step 1', 'step -1', 'escape']);
  });

  it('belong to a text field while one is typed in', () => {
    const field = document.createElement('input');
    document.body.append(field);
    key('ArrowLeft', field);
    key('Escape', field);
    expect(heard).toEqual([]);
  });
});
