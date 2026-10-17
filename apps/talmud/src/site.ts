// What the Talmud's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { parseTalmudId, talmudRef } from './layout.ts';
import { KOREN_TALMUD, SEFARIA_TALMUD, TALMUD_PAGE } from './page.ts';

/** How the Koren Noé edition's texts are licensed and where they come from. */
const KOREN = {
  url: KOREN_TALMUD,
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  collected: 'October 2026',
};

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
      collected: 'October 2026',
    },
    {
      ...KOREN,
      source: 'William Davidson Edition - Vocalized Aramaic',
      note: 'The Aramaic text of the Koren Noé edition, downloaded via Sefaria. The search index is built from it.',
    },
    {
      ...KOREN,
      source: 'William Davidson Edition - English',
      note: 'The English of the Koren Noé edition, its translation in bold, downloaded via Sefaria.',
    },
  ],
  title(link) {
    const segment = link.square ? parseTalmudId(link.square) : null;
    return viewTitle(TALMUD_PAGE.name, segment && talmudRef(segment), link);
  },
};
