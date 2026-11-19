// How the camera travels between two views: the one path every camera move follows.

import { lerpCamera } from './interpolation.ts';
import type { CameraPosition } from './types.ts';

/** How far the camera rises on a long move; larger rises higher and pans flatter (van Wijk & Nuij's rho). */
export const FLIGHT_RHO = 1.4;
/** The camera never rises until it sees more than this many times the distance it travels. */
export const FLIGHT_PEAK_PER_DISTANCE = 0.75;
/** Milliseconds per unit of path length, which counts distance in screen-widths at the high point, plus zoom change. */
export const FLIGHT_MS_PER_UNIT = 450;
/** Quickest and slowest a move takes. */
export const FLIGHT_MIN_MS = 300;
export const FLIGHT_MAX_MS = 2000;
/** A destination this many screen-widths away or less is reached by panning, not by rising. */
export const PAN_WITHIN_WIDTHS = 1;
/** The lowest zoom a flight rises to, matching the zoom floor. */
export const FLIGHT_MIN_ZOOM = 0.1;

export interface Glide {
  durationMs: number;
  /** The camera at progress `u`, from 0 (the start) to 1 (the destination). */
  at(u: number): CameraPosition;
}

interface Path {
  /** Path length: how much travel the move asks for. */
  length: number;
  /** The widest the camera sees along the path, in world units. */
  peakWidth: number;
  at(u: number): CameraPosition;
}

/** The van Wijk & Nuij (2003) path, in terms of the world width the camera sees: viewport / zoom. */
function flightPath(
  from: CameraPosition,
  to: CameraPosition,
  viewportWidth: number,
  rho: number,
): Path {
  const w0 = viewportWidth / from.zoom;
  const w1 = viewportWidth / to.zoom;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 * w0) {
    const length = Math.log(w1 / w0) / rho;
    return {
      length: Math.abs(length),
      peakWidth: Math.max(w0, w1),
      at: (u) => ({
        x: from.x,
        y: from.y,
        zoom: viewportWidth / (w0 * Math.exp(rho * u * length)),
      }),
    };
  }
  const r2 = rho * rho;
  const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * d * d) / (2 * w0 * r2 * d);
  const b1 = (w1 * w1 - w0 * w0 - r2 * r2 * d * d) / (2 * w1 * r2 * d);
  const q0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const q1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const length = (q1 - q0) / rho;
  return {
    length,
    peakWidth: Math.max(w0, w1, b0 > 0 ? w0 * Math.cosh(q0) : 0),
    at(u) {
      const s = u * length;
      const k = (w0 / (r2 * d)) * (Math.cosh(q0) * Math.tanh(rho * s + q0) - Math.sinh(q0));
      const w = (w0 * Math.cosh(q0)) / Math.cosh(rho * s + q0);
      return { x: from.x + k * dx, y: from.y + k * dy, zoom: viewportWidth / w };
    },
  };
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * How the camera gets from `from` to `to` in a viewport `viewportWidth` pixels wide.
 *
 * A destination within a screen-width is a plain eased pan, keeping the zoom ratio steady. Further
 * than that the camera rises, pans and descends, so the reader sees where the move goes instead of
 * a blur. The rise is flattened until it is no higher than FLIGHT_PEAK_PER_DISTANCE times the
 * distance and stays above FLIGHT_MIN_ZOOM. Duration follows the unflattened path, so a flatter
 * arc is not hurried. `interrupting` is for a move that starts while another is still running: it
 * eases out only, because a slow start every time would stall a held key.
 */
export function planGlide(
  from: CameraPosition,
  to: CameraPosition,
  viewportWidth: number,
  interrupting = false,
): Glide {
  const ease = interrupting ? easeOutCubic : easeInOutCubic;
  const nominal = flightPath(from, to, viewportWidth, FLIGHT_RHO);
  const durationMs = Math.min(
    FLIGHT_MAX_MS,
    Math.max(FLIGHT_MIN_MS, FLIGHT_MS_PER_UNIT * nominal.length),
  );

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const widths = (distance * Math.min(from.zoom, to.zoom)) / viewportWidth;
  if (widths <= PAN_WITHIN_WIDTHS) {
    return { durationMs, at: (u) => (u >= 1 ? { ...to } : lerpCamera(from, to, ease(u))) };
  }

  let rho = FLIGHT_RHO;
  let path = nominal;
  const tooHigh = (p: Path): boolean =>
    p.peakWidth > FLIGHT_PEAK_PER_DISTANCE * distance ||
    viewportWidth / p.peakWidth < FLIGHT_MIN_ZOOM;
  // The floor on the start and end widths: a flatter arc can never go below them.
  const lowest = Math.max(viewportWidth / from.zoom, viewportWidth / to.zoom);
  while (tooHigh(path) && path.peakWidth > lowest * 1.001 && rho > 0.05) {
    rho *= 0.97;
    path = flightPath(from, to, viewportWidth, rho);
  }
  return { durationMs, at: (u) => (u >= 1 ? { ...to } : path.at(ease(u))) };
}
