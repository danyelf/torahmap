import { describe, it, expect } from 'vitest';
import { createCamera, clampZoom, panForZoom } from '../../camera';
import type { Bounds } from '../../types';

describe('camera', () => {
  describe('createCamera', () => {
    it('creates camera centered on bounds with 1.0 zoom', () => {
      const bounds: Bounds = { width: 1000, height: 800 };
      const camera = createCamera(1920, 1080, bounds);

      expect(camera.zoom).toBe(1.0);
      expect(camera.x).toBe(1920 / 2 - 1000 / 2); // 460
      expect(camera.y).toBe(1080 / 2 - 800 / 2);  // 140
    });

    it('handles small window size', () => {
      const bounds: Bounds = { width: 1000, height: 800 };
      const camera = createCamera(800, 600, bounds);

      expect(camera.zoom).toBe(1.0);
      expect(camera.x).toBe(800 / 2 - 1000 / 2);  // -100
      expect(camera.y).toBe(600 / 2 - 800 / 2);   // -100
    });

    it('handles large window size', () => {
      const bounds: Bounds = { width: 500, height: 400 };
      const camera = createCamera(3840, 2160, bounds);

      expect(camera.zoom).toBe(1.0);
      expect(camera.x).toBe(3840 / 2 - 500 / 2);  // 1670
      expect(camera.y).toBe(2160 / 2 - 400 / 2);  // 880
    });

    it('handles zero-sized bounds', () => {
      const bounds: Bounds = { width: 0, height: 0 };
      const camera = createCamera(1920, 1080, bounds);

      expect(camera.zoom).toBe(1.0);
      expect(camera.x).toBe(1920 / 2);
      expect(camera.y).toBe(1080 / 2);
    });

    it('always returns 1.0 zoom regardless of input', () => {
      const bounds: Bounds = { width: 100, height: 100 };

      const camera1 = createCamera(800, 600, bounds);
      const camera2 = createCamera(3840, 2160, bounds);
      const camera3 = createCamera(1024, 768, bounds);

      expect(camera1.zoom).toBe(1.0);
      expect(camera2.zoom).toBe(1.0);
      expect(camera3.zoom).toBe(1.0);
    });
  });

  describe('clampZoom', () => {
    it('clamps values below minimum to 0.1', () => {
      expect(clampZoom(0.05)).toBe(0.1);
      expect(clampZoom(0.01)).toBe(0.1);
      expect(clampZoom(0)).toBe(0.1);
      expect(clampZoom(-1)).toBe(0.1);
    });

    it('clamps values above maximum to 10.0', () => {
      expect(clampZoom(10.5)).toBe(10.0);
      expect(clampZoom(20)).toBe(10.0);
      expect(clampZoom(100)).toBe(10.0);
    });

    it('returns values within range unchanged', () => {
      expect(clampZoom(0.5)).toBe(0.5);
      expect(clampZoom(1.0)).toBe(1.0);
      expect(clampZoom(5.0)).toBe(5.0);
      expect(clampZoom(9.9)).toBe(9.9);
    });

    it('handles edge cases at exact boundaries', () => {
      expect(clampZoom(0.1)).toBe(0.1);
      expect(clampZoom(10.0)).toBe(10.0);
    });

    it('handles floating point precision near boundaries', () => {
      expect(clampZoom(0.10000001)).toBe(0.10000001);
      expect(clampZoom(9.99999999)).toBe(9.99999999);
    });
  });

  describe('panForZoom', () => {
    it('adjusts pan when zooming in to keep mouse point fixed', () => {
      const pan = { x: 100, y: 100 };
      const oldZoom = 1.0;
      const newZoom = 2.0;
      const mouseX = 400;
      const mouseY = 300;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Delta should be: mouseX * (1/newZoom - 1/oldZoom)
      // = 400 * (0.5 - 1.0) = 400 * (-0.5) = -200
      expect(newPan.x).toBeCloseTo(100 - 200, 5); // -100
      expect(newPan.y).toBeCloseTo(100 - 150, 5); // -50
    });

    it('adjusts pan when zooming out to keep mouse point fixed', () => {
      const pan = { x: 100, y: 100 };
      const oldZoom = 2.0;
      const newZoom = 1.0;
      const mouseX = 400;
      const mouseY = 300;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Delta should be: mouseX * (1/newZoom - 1/oldZoom)
      // = 400 * (1.0 - 0.5) = 400 * 0.5 = 200
      expect(newPan.x).toBeCloseTo(100 + 200, 5); // 300
      expect(newPan.y).toBeCloseTo(100 + 150, 5); // 250
    });

    it('returns same pan when zoom does not change', () => {
      const pan = { x: 100, y: 100 };
      const zoom = 1.5;
      const mouseX = 400;
      const mouseY = 300;

      const newPan = panForZoom(pan, zoom, zoom, mouseX, mouseY);

      expect(newPan.x).toBeCloseTo(100, 5);
      expect(newPan.y).toBeCloseTo(100, 5);
    });

    it('handles zero mouse position', () => {
      const pan = { x: 100, y: 100 };
      const oldZoom = 1.0;
      const newZoom = 2.0;

      const newPan = panForZoom(pan, oldZoom, newZoom, 0, 0);

      // No adjustment since mouse is at 0,0
      expect(newPan.x).toBeCloseTo(100, 5);
      expect(newPan.y).toBeCloseTo(100, 5);
    });

    it('preserves world coordinate under mouse', () => {
      const pan = { x: 100, y: 200 };
      const oldZoom = 1.0;
      const newZoom = 2.0;
      const mouseX = 500;
      const mouseY = 400;

      // Calculate world coordinate before zoom
      const worldXBefore = mouseX / oldZoom - pan.x;
      const worldYBefore = mouseY / oldZoom - pan.y;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Calculate world coordinate after zoom
      const worldXAfter = mouseX / newZoom - newPan.x;
      const worldYAfter = mouseY / newZoom - newPan.y;

      // World coordinates should be identical
      expect(worldXAfter).toBeCloseTo(worldXBefore, 10);
      expect(worldYAfter).toBeCloseTo(worldYBefore, 10);
    });

    it('handles negative pan values', () => {
      const pan = { x: -50, y: -75 };
      const oldZoom = 1.0;
      const newZoom = 1.5;
      const mouseX = 300;
      const mouseY = 200;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Delta: 300 * (1/1.5 - 1/1.0) = 300 * (2/3 - 1) = 300 * (-1/3) = -100
      // Delta: 200 * (1/1.5 - 1/1.0) = 200 * (-1/3) = -66.666...
      expect(newPan.x).toBeCloseTo(-150, 5);
      expect(newPan.y).toBeCloseTo(-141.666667, 5);
    });

    it('handles fractional zoom levels', () => {
      const pan = { x: 0, y: 0 };
      const oldZoom = 0.5;
      const newZoom = 1.7;
      const mouseX = 600;
      const mouseY = 800;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Delta X: 600 * (1/1.7 - 1/0.5) = 600 * (1/1.7 - 2)
      // Delta Y: 800 * (1/1.7 - 1/0.5) = 800 * (1/1.7 - 2)
      // Using lower precision (1 decimal) to account for floating point
      expect(newPan.x).toBeCloseTo(-847.06, 1);
      expect(newPan.y).toBeCloseTo(-1129.41, 1);
    });

    it('handles large mouse coordinates', () => {
      const pan = { x: 1000, y: 1000 };
      const oldZoom = 1.0;
      const newZoom = 5.0;
      const mouseX = 3840;
      const mouseY = 2160;

      const newPan = panForZoom(pan, oldZoom, newZoom, mouseX, mouseY);

      // Delta X: 3840 * (1/5 - 1/1) = 3840 * (0.2 - 1.0) = 3840 * (-0.8) = -3072
      // Delta Y: 2160 * (0.2 - 1.0) = 2160 * (-0.8) = -1728
      expect(newPan.x).toBeCloseTo(1000 - 3072, 5);
      expect(newPan.y).toBeCloseTo(1000 - 1728, 5);
    });
  });
});
