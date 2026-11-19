// Camera module - handles zoom and pan state

import { planGlide } from './glide.ts';
import type { CameraPosition, MapItem, ZoomRange } from './types.ts';

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

/** The smallest box around all of `items`. */
export function boxAround(items: readonly ItemBox[]): WorldBox {
  return {
    minX: Math.min(...items.map((i) => i.x)),
    minY: Math.min(...items.map((i) => i.y)),
    maxX: Math.max(...items.map((i) => i.x + (i.width ?? i.size))),
    maxY: Math.max(...items.map((i) => i.y + i.size)),
  };
}

// Screen pixels kept clear around a fitted box, and below whatever is kept clear above it.
export const FIT_MARGIN = 16;

/**
 * The camera that centres `box` on a `width` × `height` canvas, `top` pixels clear above it, at
 * `zoom` or else the largest zoom that fits it inside the margins.
 */
export function cameraToFit(
  box: WorldBox,
  width: number,
  height: number,
  range: ZoomRange,
  { zoom, top = LABEL_MARGIN }: { zoom?: number; top?: number } = {},
): Camera {
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const fitted = Math.min(
    (width - 2 * FIT_MARGIN) / boxWidth,
    (height - FIT_MARGIN - top) / boxHeight,
  );
  const z = clampZoom(zoom ?? fitted, range);
  const centreY = top + (height - FIT_MARGIN - top) / 2;
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

export interface GlideOptions {
  /** Width of the map on screen, in pixels. */
  viewportWidth: number;
  /** Another move was still running when this one began. */
  interrupting?: boolean;
  /** Snap to the target instead of travelling. */
  reducedMotion?: boolean;
  /** Called once the camera has arrived, but not when the glide is stopped. */
  onDone?: () => void;
}

/**
 * Move the camera to a target along `planGlide`'s path, driven by the clock. Every camera move that
 * is not the reader's own hands goes through here.
 *
 * The camera is edited in place, because that is the object the render loop
 * reads. Returns a function that stops the glide, which the caller owes the
 * reader the moment they touch the map themselves.
 */
export function animateCameraTo(
  camera: Camera,
  target: Camera,
  onFrame: () => void,
  { viewportWidth, interrupting = false, reducedMotion = false, onDone }: GlideOptions,
): () => void {
  const glide = planGlide({ ...camera }, target, viewportWidth, interrupting);
  const durationMs = reducedMotion ? 0 : glide.durationMs;
  const started = performance.now();
  let request = 0;

  const step = (now: number): void => {
    const progress = durationMs > 0 ? Math.min(1, (now - started) / durationMs) : 1;
    Object.assign(camera, glide.at(progress));
    onFrame();
    if (progress < 1) request = requestAnimationFrame(step);
    else onDone?.();
  };

  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}
