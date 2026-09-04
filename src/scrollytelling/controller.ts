// src/scrollytelling/controller.ts

import type { ResolvedStoryStop, InterpolatedState, EasingName } from './types';
import { lerpCamera, easingFunctions } from './interpolation';

// Each stop has a "rest zone" in the middle where the view holds steady.
// REST_ZONE_FRACTION of each stop's height is the rest zone (centered).
// Transitions happen in the scroll gap between rest zones.
const REST_ZONE_FRACTION = 0.4;

/**
 * Compute the scrollTop at which each stop's content is centered in the viewport.
 * This is the scrollTop where the stop's visual center aligns with the viewport center.
 */
export function computeStopScrollCenters(
  stopOffsets: number[],
  stopHeights: number[],
  viewportHeight: number
): number[] {
  return stopOffsets.map((offset, i) => {
    const visualCenter = offset + stopHeights[i] / 2;
    return visualCenter - viewportHeight / 2;
  });
}

export function computeInterpolatedState(
  stops: ResolvedStoryStop[],
  stopOffsets: number[],
  totalHeight: number,
  scrollTop: number,
  defaultEasing: EasingName = 'ease-in-out',
  stopHeights?: number[],
  viewportHeight?: number
): InterpolatedState {
  const maxScroll = Math.max(0, totalHeight - (viewportHeight ?? 0));
  const clampedScroll = Math.max(0, Math.min(scrollTop, maxScroll));

  const heights = stopHeights ?? stopOffsets.map((offset, i) =>
    (i + 1 < stopOffsets.length ? stopOffsets[i + 1] : totalHeight) - offset
  );
  const vpHeight = viewportHeight ?? heights[0] ?? 500;

  // Compute the scrollTop where each stop is centered on screen
  const scrollCenters = computeStopScrollCenters(stopOffsets, heights, vpHeight);

  // Rest zone: a band of scroll positions around each center where we hold steady
  // The band width is REST_ZONE_FRACTION of the stop's height
  const restZones: [number, number][] = scrollCenters.map((center, i) => {
    const halfZone = (heights[i] * REST_ZONE_FRACTION) / 2;
    return [
      Math.max(0, center - halfZone),
      Math.min(maxScroll, center + halfZone),
    ];
  });

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
        return {
          camera: { ...stops[0].camera },
          fromStop: stops[0],
          toStop: stops[0],
          t: 0,
        };
      }
      // Between rest zones — transition
      const transitionStart = restZones[i - 1][1];
      const transitionEnd = restZones[i][0];
      const rawT = transitionEnd > transitionStart
        ? (clampedScroll - transitionStart) / (transitionEnd - transitionStart)
        : 1;

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
