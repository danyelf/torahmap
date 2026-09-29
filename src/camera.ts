// Camera module - handles zoom and pan state

import type { Bounds } from './types';
import { lerpCamera, easingFunctions } from './scrollytelling/interpolation.ts';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '@torahmap/link';

export interface Camera {
  x: number; // pan x position
  y: number; // pan y position
  zoom: number; // zoom level (0.1 - 10.0)
}

/** The map's canvas, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

// Opens with Genesis 1:1, the rightmost verse after the RTL mirror, this far
// in from the right edge of `windowWidth`: the map's own width unless a panel
// covers part of it.
const RIGHT_MARGIN = 320;
// Screen pixels kept clear above the verses for the book labels.
const LABEL_MARGIN = 40;

export function createCamera(
  viewport: Viewport,
  bounds: Bounds,
  windowWidth: number = viewport.width,
): Camera {
  return {
    x: bounds.width - (windowWidth - RIGHT_MARGIN - viewport.width / 2),
    y: viewport.height / 2 - LABEL_MARGIN,
    zoom: DEFAULT_ZOOM,
  };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** A point on the map's canvas, in CSS pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export function screenToWorld(
  p: ScreenPoint,
  camera: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (p.x - viewport.width / 2) / camera.zoom + camera.x,
    y: (p.y - viewport.height / 2) / camera.zoom + camera.y,
  };
}

/**
 * The offset that puts a map point on screen at `(point + offset) × zoom`,
 * which is how the shaders and the labels position what they draw.
 */
export function viewOffset(camera: Camera, viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.width / (2 * camera.zoom) - camera.x,
    y: viewport.height / (2 * camera.zoom) - camera.y,
  };
}

/** The camera at `newZoom` that keeps the map point under `point` where it is. */
export function zoomAtPoint(
  camera: Camera,
  newZoom: number,
  point: ScreenPoint,
  viewport: Viewport,
): Camera {
  const anchor = screenToWorld(point, camera, viewport);
  return {
    x: anchor.x - (point.x - viewport.width / 2) / newZoom,
    y: anchor.y - (point.y - viewport.height / 2) / newZoom,
    zoom: newZoom,
  };
}

/**
 * The centre that puts an item at `focus`.
 *
 * Takes the zoom rather than reading it, because moving and zooming at once
 * has to aim at where the item will be, not where it is now.
 */
export function centreForFocus(
  item: { x: number; y: number; size: number },
  zoom: number,
  focus: ScreenPoint,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: item.x + item.size / 2 - (focus.x - viewport.width / 2) / zoom,
    y: item.y + item.size / 2 - (focus.y - viewport.height / 2) / zoom,
  };
}

/** A rectangle in map (world) coordinates. */
export interface WorldBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Screen pixels kept clear around a fitted box, and LABEL_MARGIN above it.
const FIT_MARGIN = 16;

/**
 * The camera that centres `box` on a `width` × `height` canvas, at the largest
 * zoom that fits it inside the margins, unless `zoom` is given.
 */
export function cameraToFit(box: WorldBox, width: number, height: number, zoom?: number): Camera {
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const fitted = Math.min(
    (width - 2 * FIT_MARGIN) / boxWidth,
    (height - FIT_MARGIN - LABEL_MARGIN) / boxHeight,
  );
  const z = clampZoom(zoom ?? fitted);
  const centreY = LABEL_MARGIN + (height - FIT_MARGIN - LABEL_MARGIN) / 2;
  return {
    x: box.minX + boxWidth / 2,
    y: box.minY + boxHeight / 2 - (centreY - height / 2) / z,
    zoom: z,
  };
}

/**
 * The camera that brings an item into view at `focus`, zoomed in if the map
 * is currently scaled out past `minZoom`.
 *
 * A reader already closer than `minZoom` has said what they want to see, so
 * their zoom is left alone rather than pulled back.
 */
export function viewFocusedOn(
  item: { x: number; y: number; size: number },
  currentZoom: number,
  minZoom: number,
  focus: ScreenPoint,
  viewport: Viewport,
): Camera {
  const zoom = clampZoom(Math.max(currentZoom, minZoom));
  return { ...centreForFocus(item, zoom, focus, viewport), zoom };
}

/** How long a camera glide takes. Long enough to read as travel over the map. */
export const CAMERA_GLIDE_MS = 500;

/**
 * Glide the camera to a target, the way the story moves between its stops.
 *
 * Same interpolation and same easing as scrollytelling; only the thing driving
 * the progress differs. A story stop is driven by scroll position, and there is
 * no scroll behind a click, so this drives it from the clock instead.
 *
 * The camera is edited in place, because that is the object the render loop
 * reads. Returns a function that stops the glide, which the caller owes the
 * reader the moment they touch the map themselves.
 */
export function animateCameraTo(
  camera: Camera,
  target: Camera,
  onFrame: () => void,
  durationMs: number = CAMERA_GLIDE_MS,
): () => void {
  const from = { ...camera };
  const started = performance.now();
  let request = 0;

  const step = (now: number): void => {
    const progress = durationMs > 0 ? Math.min(1, (now - started) / durationMs) : 1;
    Object.assign(camera, lerpCamera(from, target, easingFunctions['ease-in-out'](progress)));
    onFrame();
    if (progress < 1) request = requestAnimationFrame(step);
  };

  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}
