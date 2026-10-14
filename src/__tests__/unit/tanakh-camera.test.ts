import { describe, it, expect } from 'vitest';
import { worldToScreen, type Bounds } from '@torahmap/engine';
import { createCamera } from '../../tanakh/camera.ts';
import { LINK_KEYS } from '@torahmap/overlay-catalog';

describe("the Tanakh's opening camera", () => {
  it('opens with Genesis 1:1 320 px in from the window’s right edge, below the labels', () => {
    const bounds: Bounds = { width: 1000, height: 800 };
    const view = { width: 1540, height: 1080 };
    const camera = createCamera(view, bounds, LINK_KEYS.zoom, 1920);
    // Genesis 1:1 is the rightmost verse, so its right edge is the map's.
    const corner = worldToScreen({ x: bounds.width, y: 0 }, camera, view);
    expect(corner.x).toBeCloseTo(1920 - 320, 10);
    expect(corner.y).toBeCloseTo(40, 10);
  });

  it('measures from the canvas when no window width is given', () => {
    const bounds: Bounds = { width: 500, height: 400 };
    const view = { width: 800, height: 600 };
    const corner = worldToScreen(
      { x: 500, y: 0 },
      createCamera(view, bounds, LINK_KEYS.zoom),
      view,
    );
    expect(corner.x).toBeCloseTo(800 - 320, 10);
  });

  it("opens at the text's start zoom", () => {
    const view = { width: 800, height: 600 };
    const camera = createCamera(
      view,
      { width: 500, height: 400 },
      { ...LINK_KEYS.zoom, start: 0.5 },
    );
    expect(camera.zoom).toBe(0.5);
  });
});
