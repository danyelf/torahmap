// Travelling to a verse: where the camera should end up, and how it gets there.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  centreForFocus,
  viewFocusedOn,
  animateCameraTo,
  worldToScreen,
  CAMERA_GLIDE_MS,
  MAX_ZOOM,
  type Camera,
} from '../../camera';

const VERSE = { x: 400, y: 300, size: 6 };
const FOCUS = { x: 300, y: 400 };
const VIEW = { width: 800, height: 600 };

/** Where an item lands on screen, given a camera. */
function screenPosition(item: { x: number; size: number }, camera: Camera): number {
  return worldToScreen({ x: item.x + item.size / 2, y: 0 }, camera, VIEW).x;
}

describe('centreForFocus', () => {
  it('puts the item at the focus', () => {
    const centre = centreForFocus(VERSE, 1, FOCUS, VIEW);

    expect(screenPosition(VERSE, { ...centre, zoom: 1 })).toBeCloseTo(FOCUS.x);
  });

  it('aims at the zoom it is given, not the one in the camera', () => {
    // Moving and zooming at once has to aim where the verse will be.
    const centre = centreForFocus(VERSE, 4, FOCUS, VIEW);

    expect(screenPosition(VERSE, { ...centre, zoom: 4 })).toBeCloseTo(FOCUS.x);
  });
});

describe('viewFocusedOn', () => {
  it('zooms in when the map is scaled out past the floor', () => {
    const view = viewFocusedOn(VERSE, 1, 2.5, FOCUS, VIEW);

    expect(view.zoom).toBe(2.5);
    expect(screenPosition(VERSE, view)).toBeCloseTo(FOCUS.x);
  });

  it('leaves a reader who is already closer where they are', () => {
    // Pulling them back would undo a zoom they chose.
    const view = viewFocusedOn(VERSE, 6, 2.5, FOCUS, VIEW);

    expect(view.zoom).toBe(6);
  });

  it('centres at the zoom it settles on, not the one it started from', () => {
    const view = viewFocusedOn(VERSE, 0.1, 2.5, FOCUS, VIEW);

    // The trap: centre at 0.1 and then zoom to 2.5 and the verse flies away.
    expect(screenPosition(VERSE, view)).toBeCloseTo(FOCUS.x);
  });

  it('never exceeds the maximum zoom', () => {
    expect(viewFocusedOn(VERSE, 1, MAX_ZOOM * 2, FOCUS, VIEW).zoom).toBe(MAX_ZOOM);
  });
});

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

    animateCameraTo(camera, target, () => {});
    advance(CAMERA_GLIDE_MS);

    expect(camera).toEqual(target);
  });

  it('is somewhere in between partway through, and moves every axis', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };

    animateCameraTo(camera, { x: 100, y: 50, zoom: 4 }, () => {});
    advance(CAMERA_GLIDE_MS / 2);

    expect(camera.x).toBeGreaterThan(0);
    expect(camera.x).toBeLessThan(100);
    expect(camera.y).toBeGreaterThan(0);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThan(4);
  });

  it('keeps what is in the middle of the screen still while it only zooms', () => {
    mockClock();
    const camera: Camera = { x: 500, y: 200, zoom: 1 };

    animateCameraTo(camera, { x: 500, y: 200, zoom: 4 }, () => {});
    for (const at of [0.25, 0.5, 0.75]) {
      advance(CAMERA_GLIDE_MS * at);
      const middle = worldToScreen({ x: 500, y: 200 }, camera, VIEW);
      expect(middle.x).toBeCloseTo(400, 10);
      expect(middle.y).toBeCloseTo(300, 10);
    }
  });

  it('stops where it is when cancelled, and never reaches the target', () => {
    mockClock();
    const camera: Camera = { x: 0, y: 0, zoom: 1 };

    const stop = animateCameraTo(camera, { x: 100, y: 50, zoom: 4 }, () => {});
    advance(CAMERA_GLIDE_MS / 2);
    const whereItStopped = { ...camera };
    stop();
    advance(CAMERA_GLIDE_MS);

    expect(camera).toEqual(whereItStopped);
  });

  it('reports each frame so the caller can redraw', () => {
    mockClock();
    const onFrame = vi.fn();

    animateCameraTo({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50, zoom: 4 }, onFrame);
    advance(CAMERA_GLIDE_MS / 4);
    advance(CAMERA_GLIDE_MS / 2);

    expect(onFrame).toHaveBeenCalledTimes(2);
  });
});
