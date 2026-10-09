// What the Talmud's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '../app/text.ts';
import { parseTalmudId, talmudRef } from './layout.ts';
import { SEFARIA_TALMUD, TALMUD_PAGE } from './page.ts';

export const talmudSite: Site = {
  page: TALMUD_PAGE,
  squareName: 'segment',
  aboutHtml:
    '<p>An interactive visualization of the Babylonian Talmud. Every segment has a fixed position.</p>',
  credits: [
    {
      source: 'Wikisource Talmud Bavli',
      url: SEFARIA_TALMUD,
      note: 'The Hebrew and Aramaic text, from Hebrew Wikisource, downloaded via Sefaria.',
    },
  ],
  title(link) {
    const segment = link.square ? parseTalmudId(link.square) : null;
    return viewTitle(TALMUD_PAGE.name, segment && talmudRef(segment), link);
  },
};
