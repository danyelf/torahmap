// src/scrollytelling/controller.ts

import type { ResolvedStoryStop, InterpolatedState, EasingName } from './types';
import { lerpCamera, easingFunctions } from './interpolation';

// Each stop has a "rest zone" in the middle where the view holds steady.
// REST_ZONE_FRACTION of each stop's height is the rest zone (centered).
// Transitions happen in the scroll gap between rest zones.
const REST_ZONE_FRACTION = 0.4;

/**
 * Compute the center scroll position for each stop (middle of its element).
 */
export function computeStopCenters(
  stopOffsets: number[],
  stopHeights: number[]
): number[] {
  return stopOffsets.map((offset, i) => offset + stopHeights[i] / 2);
}

/**
 * Compute the rest zone boundaries for each stop.
 * Returns [restStart, restEnd] pairs.
 */
function computeRestZones(
  stopCenters: number[],
  stopHeights: number[]
): [number, number][] {
  return stopCenters.map((center, i) => {
    const halfZone = (stopHeights[i] * REST_ZONE_FRACTION) / 2;
    return [center - halfZone, center + halfZone];
  });
}

export function computeInterpolatedState(
  stops: ResolvedStoryStop[],
  stopOffsets: number[],
  totalHeight: number,
  scrollTop: number,
  defaultEasing: EasingName = 'ease-in-out',
  stopHeights?: number[]
): InterpolatedState {
  const clampedScroll = Math.max(0, Math.min(scrollTop, totalHeight));

  // If we don't have heights, fall back to offset-based calculation
  const heights = stopHeights ?? stopOffsets.map((offset, i) =>
    (i + 1 < stopOffsets.length ? stopOffsets[i + 1] : totalHeight) - offset
  );

  const centers = computeStopCenters(stopOffsets, heights);
  const restZones = computeRestZones(centers, heights);

  // Find which stop's rest zone we're in (or between)
  for (let i = 0; i < stops.length; i++) {
    if (clampedScroll <= restZones[i][1]) {
      if (clampedScroll >= restZones[i][0]) {
        // Inside rest zone of stop i — hold steady
        return {
          camera: { ...stops[i].camera },
          fromStop: stops[i],
          toStop: stops[i],
          t: 0,
        };
      }
      if (i === 0) {
        // Before first rest zone — hold at first stop
        return {
          camera: { ...stops[0].camera },
          fromStop: stops[0],
          toStop: stops[0],
          t: 0,
        };
      }
      // Between rest zone of stop i-1 and stop i — transition
      const transitionStart = restZones[i - 1][1];
      const transitionEnd = restZones[i][0];
      const rawT = (clampedScroll - transitionStart) / (transitionEnd - transitionStart);

      const easingName = stops[i].easing ?? defaultEasing;
      const easeFn = easingFunctions[easingName] ?? easingFunctions['ease-in-out'];
      const t = easeFn(Math.max(0, Math.min(1, rawT)));

      return {
        camera: lerpCamera(stops[i - 1].camera, stops[i].camera, t),
        fromStop: stops[i - 1],
        toStop: stops[i],
        t,
      };
    }
  }

  // Past last rest zone — hold at last stop
  return {
    camera: { ...stops[stops.length - 1].camera },
    fromStop: stops[stops.length - 1],
    toStop: stops[stops.length - 1],
    t: 0,
  };
}
