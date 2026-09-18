// Who is moving the map: the story, the reader, or the story easing the map
// back from wherever the reader left it.

import type { CameraPosition, ResolvedStoryStop } from './types';

/**
 * How far the reader must scroll the story, while driving, before the story
 * takes the map back, so a trackpad nudge over the panel does not undo a view
 * the reader just built. Not yet tuned against the real app.
 */
export const REJOIN_SCROLL_PX = 60;

/** How long the story takes to ease the map back. Not yet tuned. */
export const REJOIN_EASE_MS = 700;

/**
 * How long a phone's swipe to the next stop takes to move the map. A swipe
 * snaps in a fraction of a second, which played the transition as a blink.
 */
export const SWIPE_EASE_MS = 1500;

export type Driver =
  | { by: 'story' }
  | { by: 'reader'; lastScrollTop: number; travelled: number }
  | { by: 'rejoining'; since: number; duration: number };

export const STORY_DRIVING: Driver = { by: 'story' };

export function readerTakesOver(scrollTop: number): Driver {
  return { by: 'reader', lastScrollTop: scrollTop, travelled: 0 };
}

/** Ease the map from what is on screen to where the story is, over `duration` ms. */
export function rejoinNow(now: number, duration = REJOIN_EASE_MS): Driver {
  return { by: 'rejoining', since: now, duration };
}

/**
 * Counts distance, not events: a trackpad fires many small scroll events where
 * a wheel fires few large ones.
 */
export function storyScrolled(driver: Driver, scrollTop: number, now: number): Driver {
  if (driver.by !== 'reader') return driver;

  const travelled = driver.travelled + Math.abs(scrollTop - driver.lastScrollTop);
  if (travelled >= REJOIN_SCROLL_PX) return rejoinNow(now);
  return { by: 'reader', lastScrollTop: scrollTop, travelled };
}

/** How far through the ease-back, 0 to 1. */
export function rejoinProgress(driver: Driver, now: number): number {
  if (driver.by !== 'rejoining') return 1;
  return Math.min(1, Math.max(0, (now - driver.since) / driver.duration));
}

export function settle(driver: Driver, now: number): Driver {
  return driver.by === 'rejoining' && rejoinProgress(driver, now) >= 1 ? STORY_DRIVING : driver;
}

/** The reader's view as a story stop, so the story's own blending can start from it. */
export function readerAsStop(
  camera: CameraPosition,
  overlayId: string,
  params: Record<string, string>,
): ResolvedStoryStop {
  return {
    id: 'reader',
    title: '',
    text: '',
    camera: { ...camera },
    overlay: overlayId === 'none' ? null : overlayId,
    overlayParams: params,
  };
}
