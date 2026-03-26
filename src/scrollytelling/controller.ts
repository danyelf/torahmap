// src/scrollytelling/controller.ts

import type { StoryStop, InterpolatedState, EasingName } from './types';
import { lerpCamera, easingFunctions } from './interpolation';

export function computeInterpolatedState(
  stops: StoryStop[],
  stopOffsets: number[],
  totalHeight: number,
  scrollTop: number,
  defaultEasing: EasingName = 'ease-in-out'
): InterpolatedState {
  const clampedScroll = Math.max(0, Math.min(scrollTop, totalHeight));

  // Find which two stops we're between
  let fromIndex = 0;
  for (let i = stopOffsets.length - 1; i >= 0; i--) {
    if (clampedScroll >= stopOffsets[i]) {
      fromIndex = i;
      break;
    }
  }

  const toIndex = Math.min(fromIndex + 1, stops.length - 1);

  const segmentStart = stopOffsets[fromIndex];
  const segmentEnd = fromIndex < stopOffsets.length - 1 ? stopOffsets[toIndex] : totalHeight;

  if (fromIndex === toIndex || clampedScroll === segmentStart) {
    return {
      camera: { ...stops[fromIndex].camera },
      fromStop: stops[fromIndex],
      toStop: stops[fromIndex],
      t: 0,
    };
  }

  const rawT = (clampedScroll - segmentStart) / (segmentEnd - segmentStart);

  const easingName = stops[toIndex].easing ?? defaultEasing;
  const easeFn = easingFunctions[easingName] ?? easingFunctions['ease-in-out'];
  const t = easeFn(rawT);

  return {
    camera: lerpCamera(stops[fromIndex].camera, stops[toIndex].camera, t),
    fromStop: stops[fromIndex],
    toStop: stops[toIndex],
    t,
  };
}
