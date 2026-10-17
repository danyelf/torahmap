// Camera module - handles zoom and pan state

import { lerpCamera, easingFunctions } from './interpolation.ts';
import { DEFAULT_EASING, type CameraPosition, type MapItem, type ZoomRange } from './types.ts';

/** Where a square stands and how big it is: all the camera needs to aim at it. */
export type ItemBox = Pick<MapItem, 'x' | 'y' | 'size' | 'width'>;

export type Camera = CameraPosition;

// Screen pixels kept clear above the squares for the labels.
export const LABEL_MARGIN = 40;

/** The map's canvas, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

export function clampZoom(zoom: number, range: ZoomRange): number {
  return Math.max(range.min, Math.min(range.max, zoom));
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

/** Where a map point lands on the canvas: the inverse of screenToWorld. */
export function worldToScreen(
  p: { x: number; y: number },
  camera: Camera,
  viewport: Viewport,
): ScreenPoint {
  const offset = viewOffset(camera, viewport);
  return { x: (p.x + offset.x) * camera.zoom, y: (p.y + offset.y) * camera.zoom };
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
  item: ItemBox,
  zoom: number,
  focus: ScreenPoint,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: item.x + (item.width ?? item.size) / 2 - (focus.x - viewport.width / 2) / zoom,
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
export const FIT_MARGIN = 16;

/**
 * The camera that centres `box` on a `width` × `height` canvas, at the largest
 * zoom that fits it inside the margins, unless `zoom` is given.
 */
export function cameraToFit(
  box: WorldBox,
  width: number,
  height: number,
  range: ZoomRange,
  zoom?: number,
): Camera {
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const fitted = Math.min(
    (width - 2 * FIT_MARGIN) / boxWidth,
    (height - FIT_MARGIN - LABEL_MARGIN) / boxHeight,
  );
  const z = clampZoom(zoom ?? fitted, range);
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
  item: ItemBox,
  currentZoom: number,
  minZoom: number,
  focus: ScreenPoint,
  viewport: Viewport,
  range: ZoomRange,
): Camera {
  const zoom = clampZoom(Math.max(currentZoom, minZoom), range);
  return { ...centreForFocus(item, zoom, focus, viewport), zoom };
}

/** How long a camera glide takes. Long enough to read as travel over the map. */
export const CAMERA_GLIDE_MS = 500;

/**
 * Glide the camera to a target, the way the story moves between its stops.
 *
 * The same interpolation and easing a story uses between stops (`lerpCamera`
 * with `DEFAULT_EASING`); only the thing driving the progress differs. A story stop is driven by scroll position, and there is
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
    Object.assign(camera, lerpCamera(from, target, easingFunctions[DEFAULT_EASING](progress)));
    onFrame();
    if (progress < 1) request = requestAnimationFrame(step);
  };

  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}
