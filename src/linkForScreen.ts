import { linkKind, type UrlState } from '@torahmap/link';
import type { DriverKind } from './scrollytelling/driver';
import type { Frame } from './frame.ts';

/**
 * The link for what is on screen: the story's stop while the story has the
 * map, and otherwise the reader's own view.
 */
export function linkForScreen(screen: {
  mode: Frame['mode'];
  driver: DriverKind;
  story: { id: string; stop: string };
  explore: () => UrlState; // built only when needed
}): UrlState {
  if (screen.mode === 'story' && screen.driver === 'story') {
    return { story: screen.story.id, stop: screen.story.stop, overlayParams: {} };
  }
  return screen.explore();
}

/**
 * Whether writing `next` over `current` should push a history entry rather
 * than replace one. Leaving a story for the reader's own view pushes
 * regardless of `asked` — that is the one Back step to the stop a takeover
 * adds, no matter which of the reader's own writes ends up making it.
 * Everywhere else, `asked` decides.
 */
export function pushes(current: UrlState, next: UrlState, asked: boolean): boolean {
  const leavesStory = linkKind(current) === 'stop' && linkKind(next) !== 'stop';
  return asked || leavesStory;
}
