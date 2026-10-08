// What a link is called in a tab and a chat preview.

import { linkKind, parseVerseId, verseRef, type UrlState } from '@torahmap/link';
import { overlayName } from '@torahmap/overlay-catalog';
import { STORIES, listedStories, storyToOpen, firstSentence } from '@torahmap/stories';

export const SITE_NAME = 'Torahmap';
export const TAGLINE = 'A Visual Concordance of the Hebrew Bible.';
const SEPARATOR = ' · ';

// torahmap.org's list; a preview build that lists drafts can open another story.
const LISTED = listedStories(STORIES, false);

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

/** A view's title on any text's site: what it pins, then its search, then the site's name. */
export function viewTitle(siteName: string, pinned: string | null, state: UrlState): string {
  const search = state.searchParams?.search;
  return [pinned, search && `Search: ${search}`, siteName].filter(Boolean).join(SEPARATOR);
}
