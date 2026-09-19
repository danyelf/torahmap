// Who is moving the map, and so what it shows: the story, at rest on a stop or
// blending two; the reader; or a timed ease from what was on screen to where
// the story is.

import type { Color } from '../overlays/types';
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

type Colors = (Color | Color[])[];

/** Between two stops as the story scrolls, `t` of the way from one to the other. */
export interface StoryBlend {
  from: ResolvedStoryStop;
  to: ResolvedStoryStop;
  t: number;
}

export type Driver =
  | { by: 'story'; blend: StoryBlend | null }
  | { by: 'reader'; lastScrollTop: number; travelled: number }
  // The colours at both ends are captured when the ease starts, so each frame
  // blends two arrays instead of re-running the overlays' colouring. The camera
  // eases towards wherever the story is on each frame.
  | {
      by: 'rejoining';
      since: number;
      duration: number;
      fromCamera: CameraPosition;
      fromColors: Colors;
      toColors: Colors;
    };

export const STORY_DRIVING: Driver = { by: 'story', blend: null };

type ReaderDriving = Extract<Driver, { by: 'reader' }>;

export function readerTakesOver(scrollTop: number): ReaderDriving {
  return { by: 'reader', lastScrollTop: scrollTop, travelled: 0 };
}

export function rejoin(
  now: number,
  duration: number,
  fromCamera: CameraPosition,
  fromColors: Colors,
  toColors: Colors,
): Driver {
  return {
    by: 'rejoining',
    since: now,
    duration,
    fromCamera: { ...fromCamera },
    fromColors,
    toColors,
  };
}

/**
 * A scroll while the reader drives only counts towards handing the map back,
 * and returns 'rejoin' once it has. Counts distance, not events: a trackpad
 * fires many small scroll events where a wheel fires few large ones.
 */
export function storyScrolled(driver: ReaderDriving, scrollTop: number): ReaderDriving | 'rejoin' {
  const travelled = driver.travelled + Math.abs(scrollTop - driver.lastScrollTop);
  if (travelled >= REJOIN_SCROLL_PX) return 'rejoin';
  return { by: 'reader', lastScrollTop: scrollTop, travelled };
}

/** How far through the ease, 0 to 1. */
export function rejoinProgress(driver: Driver, now: number): number {
  if (driver.by !== 'rejoining') return 1;
  return Math.min(1, Math.max(0, (now - driver.since) / driver.duration));
}

export function settle(driver: Driver, now: number): Driver {
  return driver.by === 'rejoining' && rejoinProgress(driver, now) >= 1 ? STORY_DRIVING : driver;
}

/** What the colour layer is drawn from, for deciding what a hover makes stale. */
export function colorSource(driver: Driver): 'overlay' | 'blend' | 'ease' {
  if (driver.by === 'rejoining') return 'ease';
  return driver.by === 'story' && driver.blend ? 'blend' : 'overlay';
}
