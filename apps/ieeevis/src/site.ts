// What the IEEE VIS map's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { IEEEVIS_PAGE } from './page.ts';

export const ieeevisSite: Site = {
  page: IEEEVIS_PAGE,
  direction: 'ltr',
  squareName: 'piece',
  aboutHtml:
    '<p>An interactive map of the IEEE VIS 2026 program. Each square is a piece of a paper, about 250 words or a quarter page. Papers sit in their sessions, sessions in their days. Outlined squares are papers whose text is not loaded; their length is estimated from the kind of paper.</p>',
  credits: [
    {
      source: 'IEEE VIS 2026 program',
      url: 'https://ieeevis.org/',
      note: 'Titles, authors, sessions and times; paper text from arXiv where available.',
      collected: 'October 2026',
    },
  ],
  title(link) {
    return viewTitle(IEEEVIS_PAGE.name, link.square ?? null, link);
  },
};
