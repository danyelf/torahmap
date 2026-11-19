// Travelling to a square: where the camera should end up, and how it gets there.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  centreForFocus,
  viewFocusedOn,
  animateCameraTo,
  planGlide,
  FLIGHT_MIN_ZOOM,
  FLIGHT_MIN_MS,
  FLIGHT_MAX_MS,
  FLIGHT_PEAK_PER_DISTANCE,
  type Camera,
  worldToScreen,
} from '../src/index.ts';
import { ZOOM } from './fixtures.ts';

const ITEM = { x: 400, y: 300, size: 6 };
const FOCUS = { x: 300, y: 400 };
const VIEW = { width: 800, height: 600 };

/** Where an item lands on screen, given a camera. */
function screenPosition(item: { x: number; size: number }, camera: Camera): number {
  return worldToScreen({ x: item.x + item.size / 2, y: 0 }, camera, VIEW).x;
}

describe('centreForFocus', () => {
  it('puts the item at the focus', () => {
    const centre = centreForFocus(ITEM, 1, FOCUS, VIEW);

    expect(screenPosition(ITEM, { ...centre, zoom: 1 })).toBeCloseTo(FOCUS.x);
  });

  it('aims at the zoom it is given, not the one in the camera', () => {
    // Moving and zooming at once has to aim where the square will be.
    const centre = centreForFocus(ITEM, 4, FOCUS, VIEW);

    expect(screenPosition(ITEM, { ...centre, zoom: 4 })).toBeCloseTo(FOCUS.x);
  });
});

describe('viewFocusedOn', () => {
  it('zooms in when the map is scaled out past the floor', () => {
    const view = viewFocusedOn(ITEM, 1, 2.5, FOCUS, VIEW, ZOOM);

    expect(view.zoom).toBe(2.5);
    expect(screenPosition(ITEM, view)).toBeCloseTo(FOCUS.x);
  });

  it('leaves a reader who is already closer where they are', () => {
    // Pulling them back would undo a zoom they chose.
    const view = viewFocusedOn(ITEM, 6, 2.5, FOCUS, VIEW, ZOOM);

    expect(view.zoom).toBe(6);
  });

  it('centres at the zoom it settles on, not the one it started from', () => {
    const view = viewFocusedOn(ITEM, 0.1, 2.5, FOCUS, VIEW, ZOOM);

    // The trap: centre at 0.1 and then zoom to 2.5 and the square flies away.
    expect(screenPosition(ITEM, view)).toBeCloseTo(FOCUS.x);
  });

  it('never exceeds the maximum zoom', () => {
    expect(viewFocusedOn(ITEM, 1, ZOOM.max * 2, FOCUS, VIEW, ZOOM).zoom).toBe(ZOOM.max);
  });
});

const OPTIONS = { viewportWidth: 800 };
const takes = (from: Camera, to: Camera): number =>
  planGlide(from, to, OPTIONS.viewportWidth).durationMs;
const LONG = takes({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50, zoom: 4 });
const ZOOM_ONLY = takes({ x: 500, y: 200, zoom: 1 }, { x: 500, y: 200, zoom: 4 });

describe('animateCameraTo', () => {
  let now = 0;
  const frames: Array<(t: number) => void> = [];

  function mockClock(): void {
    now = 0;
    frames.length = 0;
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames[id - 1] = () => {};
    });
  }

  /** Run the one pending frame, at `at` milliseconds from the start. */
  function advance(at: number): void {
    const pending = frames.pop();
    now = at;
    pending?.(at);
  }

  afterEach(() => vi.unstubAllGlobals());

  it('lands exactly on the target', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const target: Camera = { x: 100, y: 50, zoom: 4 };

    animateCameraTo(camera, target, () => {}, OPTIONS);
    advance(LONG);

    expect(camera).toEqual(target);
  });

  it('is somewhere in between partway through, and moves every axis', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };

    animateCameraTo(camera, { x: 100, y: 50, zoom: 4 }, () => {}, OPTIONS);
    advance(LONG / 2);

    expect(camera.x).toBeGreaterThan(0);
    expect(camera.x).toBeLessThan(100);
    expect(camera.y).toBeGreaterThan(0);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThan(4);
  });

  it('keeps what is in the middle of the screen still while it only zooms', () => {
    mockClock();
    const camera: Camera = { x: 500, y: 200, zoom: 1 };

    animateCameraTo(camera, { x: 500, y: 200, zoom: 4 }, () => {}, OPTIONS);
    for (const at of [0.25, 0.5, 0.75]) {
      advance(ZOOM_ONLY * at);
      const middle = worldToScreen({ x: 500, y: 200 }, camera, VIEW);
      expect(middle.x).toBeCloseTo(400, 10);
      expect(middle.y).toBeCloseTo(300, 10);
    }
  });

  it('stops where it is when cancelled, and never reaches the target', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };

    const stop = animateCameraTo(camera, { x: 100, y: 50, zoom: 4 }, () => {}, OPTIONS);
    advance(LONG / 2);
    const whereItStopped = { ...camera };
    stop();
    advance(LONG);

    expect(camera).toEqual(whereItStopped);
  });

  it('reports each frame so the caller can redraw', () => {
    mockClock();
    const onFrame = vi.fn();

    animateCameraTo({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50, zoom: 4 }, onFrame, OPTIONS);
    advance(LONG / 4);
    advance(LONG / 2);

    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('snaps to the target in one frame under reduced motion', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const target: Camera = { x: 5000, y: 50, zoom: 4 };

    animateCameraTo(camera, target, () => {}, { ...OPTIONS, reducedMotion: true });
    advance(1);

    expect(camera).toEqual(target);
  });

  it('says when it has arrived, and not when it is stopped', () => {
    mockClock();
    const onDone = vi.fn();
    const stop = animateCameraTo({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50, zoom: 4 }, () => {}, {
      ...OPTIONS,
      onDone,
    });
    advance(LONG / 2);
    expect(onDone).not.toHaveBeenCalled();
    advance(LONG);
    expect(onDone).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('planGlide', () => {
  const WIDTH = 1000;
  const start = { x: 0, y: 0, zoom: 2.5 };
  const far = { x: 8000, y: 3000, zoom: 2.5 };
  const middling = { x: 1500, y: 0, zoom: 2.5 };
  const near = { x: 100, y: 20, zoom: 2.5 };

  it('starts at the first view and ends exactly on the second', () => {
    for (const to of [far, middling, near, { x: 40, y: 0, zoom: 6 }]) {
      const glide = planGlide(start, to, WIDTH);
      expect(glide.at(0).x).toBeCloseTo(start.x, 6);
      expect(glide.at(0).zoom).toBeCloseTo(start.zoom, 6);
      expect(glide.at(1)).toEqual(to);
    }
  });

  it('rises on a long move and does not go below the zoom floor', () => {
    const glide = planGlide(start, far, WIDTH);
    const zooms = Array.from({ length: 101 }, (_, i) => glide.at(i / 100).zoom);

    expect(Math.min(...zooms)).toBeLessThan(start.zoom / 2);
    expect(Math.min(...zooms)).toBeGreaterThanOrEqual(FLIGHT_MIN_ZOOM);
  });

  it('keeps the zoom of a move to somewhere already on screen', () => {
    const glide = planGlide(start, near, WIDTH);

    for (let i = 0; i <= 10; i++) expect(glide.at(i / 10).zoom).toBeCloseTo(start.zoom, 6);
  });

  it('rises less on a middling move than a long one, in proportion to the distance', () => {
    const lowest = (to: Camera): number => {
      const glide = planGlide(start, to, WIDTH);
      return Math.min(...Array.from({ length: 101 }, (_, i) => glide.at(i / 100).zoom));
    };
    const seenAtTop = (to: Camera, distance: number): number => WIDTH / lowest(to) / distance;

    expect(seenAtTop(middling, 1500)).toBeLessThanOrEqual(FLIGHT_PEAK_PER_DISTANCE + 1e-6);
  });

  it('takes longer for a longer move, within its limits', () => {
    const ms = (to: Camera): number => planGlide(start, to, WIDTH).durationMs;

    expect(ms(far)).toBeGreaterThan(ms(middling));
    expect(ms(middling)).toBeGreaterThanOrEqual(ms(near));
    expect(ms(near)).toBeGreaterThanOrEqual(FLIGHT_MIN_MS);
    expect(ms({ x: 1e9, y: 0, zoom: 2.5 })).toBeLessThanOrEqual(FLIGHT_MAX_MS);
  });

  it('never moves backwards on the way, even when interrupting', () => {
    for (const interrupting of [false, true]) {
      const glide = planGlide(start, near, WIDTH, interrupting);
      let last = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const x = glide.at(i / 20).x;
        expect(x).toBeGreaterThanOrEqual(last);
        last = x;
      }
    }
  });

  it('starts moving at once when it interrupts another move', () => {
    const slowStart = planGlide(start, near, WIDTH).at(0.05).x;
    const quickStart = planGlide(start, near, WIDTH, true).at(0.05).x;

    expect(quickStart).toBeGreaterThan(slowStart * 5);
  });
});
