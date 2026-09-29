// What a link is called in a tab and a chat preview.

import { linkKind, parseVerseFromUrl, verseRef, type UrlState } from '@torahmap/link';
import { overlayName } from '@torahmap/overlay-catalog';
import { STORIES, listedStories, storyToOpen, storyTitle, stopOpening } from '@torahmap/stories';

export const SITE_NAME = 'Torahmap';
export const TAGLINE = 'A Visual Concordance of the Hebrew Bible.';
const SEPARATOR = ' · ';

/** Fills index.html's %SITE_NAME%/%TAGLINE% placeholders; the Vite build runs it on the page. */
export function fillSiteTags(html: string): string {
  return html.replace(/%SITE_NAME%/g, SITE_NAME).replace(/%TAGLINE%/g, TAGLINE);
}

export interface LinkDescription {
  title: string;
  description: string;
}

/** The title names what the link points at, most specific first, because tabs and previews cut from the right. */
export function describeLink(state: UrlState): LinkDescription {
  if (linkKind(state) === 'stop') {
    // torahmap.org's default; a preview build that lists drafts could open another.
    const story = state.story ?? storyToOpen(listedStories(STORIES, false), null).id;
    const title = story ? storyTitle(story) : undefined;
    const opening = story && state.stop ? stopOpening(story, state.stop) : undefined;
    return {
      title: title ? [title, SITE_NAME].join(SEPARATOR) : SITE_NAME,
      description: opening ? `${opening} ${TAGLINE}` : TAGLINE,
    };
  }
  const verse = state.verse ? parseVerseFromUrl(state.verse) : null;
  const search = state.searchParams?.search;
  const parts = [verse && verseRef(verse), search && `Search: ${search}`, SITE_NAME].filter(
    Boolean,
  );
  const overlay = state.overlay ? overlayName(state.overlay) : undefined;
  return {
    title: parts.join(SEPARATOR),
    description: overlay ? `${overlay} overlay. ${TAGLINE}` : TAGLINE,
  };
}
