// What the IEEE VIS map's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { IEEEVIS_PAGE, WORDS_PER_SQUARE } from './page.ts';

export const ieeevisSite: Site = {
  page: IEEEVIS_PAGE,
  direction: 'ltr',
  squareName: 'piece',
  email: 'danyel@danyelfisher.info',
  aboutHtml: `<p>An interactive map of the IEEE VIS 2026 program. Each square represents about ${WORDS_PER_SQUARE} words from a paper. Papers sit in their sessions, sessions in their days. Outlined squares are papers whose text is not loaded; their length is estimated from the kind of paper.</p>`,
  credits: [
    {
      source: 'IEEE VIS 2026 program',
      url: IEEEVIS_PAGE.textUrl,
      note: 'Titles, authors, sessions and times; paper text from arXiv where available.',
      collected: 'October 2026',
    },
  ],
  title(link) {
    return viewTitle(IEEEVIS_PAGE.name, link.square ?? null, link);
  },
};
