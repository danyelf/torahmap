// What a Tanakh link is called in a tab and a chat preview.

import { linkKind, type UrlState } from '@torahmap/link';
import { parseVerseId, verseRef } from '@torahmap/link/verse';
import { overlayName } from '@torahmap/overlay-catalog';
import { listedStories, storyToOpen, firstSentence } from '@torahmap/stories';
import { STORIES } from '@torahmap/stories/tanakh';
import { SEPARATOR, viewTitle } from './view.ts';

export const SITE_NAME = 'Torahmap';
export const TAGLINE = 'A Visual Concordance of the Hebrew Bible.';

// torahmap.org's list; a preview build that lists drafts can open another story.
const LISTED = listedStories(STORIES, false);

export interface LinkDescription {
  title: string;
  description: string;
}

/** The title names what the link points at, most specific first, because tabs and previews cut from the right. */
export function describeLink(state: UrlState): LinkDescription {
  if (linkKind(state) === 'stop') {
    const story = storyToOpen(LISTED, state.story ?? null);
    const title = story?.data.title;
    const stop = story?.data.stops.find((s) => s.id === state.stop);
    const opening = stop && firstSentence(stop);
    return {
      title: title ? [title, SITE_NAME].join(SEPARATOR) : SITE_NAME,
      description: opening ? `${opening} ${TAGLINE}` : TAGLINE,
    };
  }
  const verse = state.square ? parseVerseId(state.square) : null;
  const overlay = state.overlay ? overlayName(state.overlay) : undefined;
  return {
    title: viewTitle(SITE_NAME, verse && verseRef(verse), state),
    description: overlay ? `${overlay} overlay. ${TAGLINE}` : TAGLINE,
  };
}
