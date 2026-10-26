import type { Color } from '@torahmap/utils';

/** A square's colour, or its stripes. */
export type ItemColor = Color | Color[];

/**
 * A square on the map. The app compares and finds squares by id without
 * knowing what they hold. Drawing, hit testing and the camera read only this.
 */
export interface MapItem {
  id: string;
  x: number;
  y: number;
  /** The square's height in map units, and its width unless `width` says otherwise. */
  size: number;
  width?: number;
  /**
   * How far the square is drawn from its place, so the squares do not line up
   * into a grid. Taken out as they are widened into bars.
   */
  jitter?: { x: number; y: number };
  /** Drawn as a circle, with a ring as a circular band, where the square is big enough for a ring's hole. */
  round?: boolean;
}

/** A text's own fields (book, chapter and verse; or a Talmud segment) on a square. */
export type SpatialItem<T> = T & MapItem;

export interface Bounds {
  width: number;
  height: number;
}

/** Where the camera is: the map point at the canvas's centre, and the zoom. */
export interface CameraPosition {
  x: number;
  y: number;
  zoom: number;
}

/**
 * A text's zooms: the range its camera allows, which is the range a link may
 * carry, to two decimals; and `start`, the zoom a link leaves out.
 */
export interface ZoomRange {
  readonly min: number;
  readonly max: number;
  readonly start: number;
}

export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;
export type EasingName = (typeof EASINGS)[number];

/** How the camera moves when nothing says otherwise. */
export const DEFAULT_EASING: EasingName = 'ease-in-out';
