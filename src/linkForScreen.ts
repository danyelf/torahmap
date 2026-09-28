// What is on screen decides the link: the story's stop while the story has
// the map, an ordinary explore link once the reader takes it — see
// docs/plans/2026-09-28-sharing-a-view.md, "The link".

import type { UrlState } from '@torahmap/link';
import type { DriverKind } from './scrollytelling/driver';

/**
 * The link for what is on screen: the story's stop while the story has the
 * map, and otherwise the reader's own view.
 */
export function linkForScreen(screen: {
  mode: 'story' | 'explore';
  driver: DriverKind;
  story: { id: string; stop: string };
  explore: () => UrlState; // built only when needed
}): UrlState {
  if (screen.mode === 'story' && screen.driver === 'story') {
    return { story: screen.story.id, stop: screen.story.stop, overlayParams: {} };
  }
  return screen.explore();
}
