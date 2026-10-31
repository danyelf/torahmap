import { describe, it, expect } from 'vitest';
import {
  boxAround,
  clampZoom,
  cameraToFit,
  screenToWorld,
  viewOffset,
  zoomAtPoint,
  centreForFocus,
  type Camera,
  worldToScreen,
} from '../src/index.ts';
import { ZOOM } from './fixtures.ts';

describe('camera', () => {
  describe('clampZoom', () => {
    it('clamps values below minimum to the minimum', () => {
      expect(clampZoom(0.05, ZOOM)).toBe(0.1);
      expect(clampZoom(0, ZOOM)).toBe(0.1);
      expect(clampZoom(-1, ZOOM)).toBe(0.1);
    });

    it('clamps values above maximum to the maximum', () => {
      expect(clampZoom(10.5, ZOOM)).toBe(10.0);
      expect(clampZoom(100, ZOOM)).toBe(10.0);
    });

    it('returns values within range unchanged, boundaries included', () => {
      expect(clampZoom(0.1, ZOOM)).toBe(0.1);
      expect(clampZoom(5.0, ZOOM)).toBe(5.0);
      expect(clampZoom(10.0, ZOOM)).toBe(10.0);
      expect(clampZoom(0.10000001, ZOOM)).toBe(0.10000001);
    });

    it("keeps to the text's own range", () => {
      const wide = { min: 0.01, max: 4, start: 0.5 };
      expect(clampZoom(0.05, wide)).toBe(0.05);
      expect(clampZoom(5, wide)).toBe(4);
    });
  });
});

describe('cameraToFit', () => {
  const box = { minX: 100, minY: 50, maxX: 500, maxY: 250 };
  const onScreen = (x: number, y: number, c: Camera, width: number, height: number) =>
    worldToScreen({ x, y }, c, { width, height });

  it('fits a wide box to the width, centred', () => {
    const c = cameraToFit(box, 832, 1000, ZOOM);
    expect(c.zoom).toBeCloseTo(2);
    const topLeft = onScreen(box.minX, box.minY, c, 832, 1000);
    const bottomRight = onScreen(box.maxX, box.maxY, c, 832, 1000);
    expect(topLeft.x).toBeCloseTo(16);
    expect(bottomRight.x).toBeCloseTo(816);
    // Centred below the room kept for book labels.
    expect(topLeft.y - 40).toBeCloseTo(1000 - 16 - bottomRight.y);
  });

  it('fits a tall box to the height, below the book labels', () => {
    const c = cameraToFit(box, 4000, 256, ZOOM);
    expect(c.zoom).toBeCloseTo(1);
    expect(onScreen(box.minX, box.minY, c, 4000, 256).y).toBeCloseTo(40);
    expect(onScreen(box.maxX, box.maxY, c, 4000, 256).y).toBeCloseTo(240);
    expect(onScreen(300, 150, c, 4000, 256).x).toBeCloseTo(2000);
  });

  it('keeps the box centred at a given zoom', () => {
    const c = cameraToFit(box, 832, 1000, ZOOM, 0.5);
    expect(c.zoom).toBe(0.5);
    expect(onScreen(300, 150, c, 832, 1000).x).toBeCloseTo(416);
  });

  it('keeps a given room clear above a tall box', () => {
    const c = cameraToFit(box, 4000, 286, ZOOM, undefined, 70);
    expect(c.zoom).toBeCloseTo(1);
    expect(onScreen(box.minX, box.minY, c, 4000, 286).y).toBeCloseTo(70);
    expect(onScreen(box.maxX, box.maxY, c, 4000, 286).y).toBeCloseTo(270);
  });
});

describe('map and screen', () => {
  const view = { width: 800, height: 600 };
  const camera = { x: 1000, y: 400, zoom: 2 };

  it('puts the camera’s point at the middle of the canvas', () => {
    expect(worldToScreen({ x: 1000, y: 400 }, camera, view)).toEqual({ x: 400, y: 300 });
  });

  it('round-trips a point', () => {
    const p = { x: 1234.5, y: -87 };
    const back = screenToWorld(worldToScreen(p, camera, view), camera, view);
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });

  it('gives the offset the shaders position by', () => {
    const offset = viewOffset(camera, view);
    const p = { x: 1100, y: 350 };
    const screen = worldToScreen(p, camera, view);
    expect((p.x + offset.x) * camera.zoom).toBeCloseTo(screen.x, 10);
    expect((p.y + offset.y) * camera.zoom).toBeCloseTo(screen.y, 10);
  });

  it('keeps the same point in the middle when the canvas is resized', () => {
    const wider = { width: 1200, height: 900 };
    expect(worldToScreen({ x: 1000, y: 400 }, camera, wider)).toEqual({ x: 600, y: 450 });
  });
});

describe('zoomAtPoint', () => {
  const view = { width: 800, height: 600 };
  const camera = { x: 1000, y: 400, zoom: 1 };

  it('holds the map point under the cursor still', () => {
    const cursor = { x: 120, y: 510 };
    const before = screenToWorld(cursor, camera, view);
    const zoomed = zoomAtPoint(camera, 3.5, cursor, view);
    const after = screenToWorld(cursor, zoomed, view);
    expect(zoomed.zoom).toBe(3.5);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('leaves the centre alone when zooming about the middle', () => {
    const zoomed = zoomAtPoint(camera, 0.4, { x: 400, y: 300 }, view);
    expect(zoomed.x).toBeCloseTo(1000, 10);
    expect(zoomed.y).toBeCloseTo(400, 10);
  });
});

describe('centreForFocus', () => {
  const view = { width: 800, height: 600 };
  const item = { x: 400, y: 300, size: 6 };

  it('puts the item at a focus away from the middle', () => {
    // The phone centres squares above the middle, clear of the story sheet.
    const focus = { x: 400, y: 228 };
    const centre = centreForFocus(item, 2.5, focus, view);
    const screen = worldToScreen({ x: 403, y: 303 }, { ...centre, zoom: 2.5 }, view);
    expect(screen.x).toBeCloseTo(focus.x, 10);
    expect(screen.y).toBeCloseTo(focus.y, 10);
  });
});

describe('boxAround', () => {
  it('bounds every item, a wide one by its width', () => {
    expect(
      boxAround([
        { x: 10, y: 20, size: 6 },
        { x: 0, y: 40, size: 6, width: 30 },
      ]),
    ).toEqual({ minX: 0, minY: 20, maxX: 30, maxY: 46 });
  });
});
