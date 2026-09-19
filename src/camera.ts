// Camera module - handles zoom and pan state

import type { Bounds } from './types';
import { lerpCamera, easingFunctions } from './scrollytelling/interpolation.ts';

export interface Camera {
  x: number; // pan x position
  y: number; // pan y position
  zoom: number; // zoom level (0.1 - 10.0)
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

// Keeps Genesis 1:1 clear of the right-panel sidebar; wider than the panel
// itself so the verse isn't flush against its edge.
const RIGHT_MARGIN = 320;
// Top margin to leave room for book labels above the first row
const TOP_MARGIN = 40;

// At zoom=1, screenX = worldX + pan.x, and Genesis 1:1 sits near worldX ≈
// bounds.width (rightmost after RTL mirror). Solving screenX = cssWidth -
// RIGHT_MARGIN for pan.x gives the offset below.
export function createCamera(cssWidth: number, _cssHeight: number, bounds: Bounds): Camera {
  return {
    x: cssWidth - RIGHT_MARGIN - bounds.width,
    y: TOP_MARGIN,
    zoom: 1.0,
  };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/**
 * Adjust pan to keep world point under mouse fixed during zoom.
 *
 * Formula:
 *   Before: worldX = mouseX / oldZoom - pan.x
 *   After:  worldX = mouseX / newZoom - newPan.x
 *   Solving: newPan.x = pan.x + mouseX * (1/newZoom - 1/oldZoom)
 *
 * @param pan - Current pan position
 * @param oldZoom - Zoom level before change
 * @param newZoom - Zoom level after change
 * @param mouseX - Mouse X position in screen coordinates
 * @param mouseY - Mouse Y position in screen coordinates
 * @returns New pan position
 */
export function panForZoom(
  pan: { x: number; y: number },
  oldZoom: number,
  newZoom: number,
  mouseX: number,
  mouseY: number,
): { x: number; y: number } {
  return {
    x: pan.x + mouseX * (1 / newZoom - 1 / oldZoom),
    y: pan.y + mouseY * (1 / newZoom - 1 / oldZoom),
  };
}

/** A point on the map's canvas, in CSS pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Where the camera has to sit for an item to be at `focus`.
 *
 * Takes the zoom rather than reading it, because moving and zooming at once
 * has to aim at where the item will be, not where it is now.
 */
export function panToFocus(
  item: { x: number; y: number; size: number },
  zoom: number,
  focus: ScreenPoint,
): { x: number; y: number } {
  return {
    x: focus.x / zoom - item.x - item.size / 2,
    y: focus.y / zoom - item.y - item.size / 2,
  };
}

/** A rectangle in map (world) coordinates. */
export interface WorldBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Screen pixels kept clear around a fitted box. The top is larger because the
// book labels sit above the verses.
const FIT_MARGIN = 16;
const FIT_TOP_MARGIN = 40;

/**
 * The camera that centres `box` on a `width` × `height` canvas, at the largest
 * zoom that fits it inside the margins, unless `zoom` is given.
 */
export function cameraToFit(box: WorldBox, width: number, height: number, zoom?: number): Camera {
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const fitted = Math.min(
    (width - 2 * FIT_MARGIN) / boxWidth,
    (height - FIT_MARGIN - FIT_TOP_MARGIN) / boxHeight,
  );
  const z = clampZoom(zoom ?? fitted);
  const centreY = FIT_TOP_MARGIN + (height - FIT_MARGIN - FIT_TOP_MARGIN) / 2;
  return {
    x: width / 2 / z - (box.minX + boxWidth / 2),
    y: centreY / z - (box.minY + boxHeight / 2),
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
): Camera {
  const zoom = clampZoom(Math.max(currentZoom, minZoom));
  return { ...panToFocus(item, zoom, focus), zoom };
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
