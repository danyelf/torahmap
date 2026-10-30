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
  direction: 'rtl',
  squareName: 'segment',
  aboutHtml:
    '<p>An interactive visualization of the Babylonian Talmud. Every segment has a fixed position.</p>',
  credits: [
    {
      ...KOREN,
      source: 'William Davidson Edition - Vocalized Aramaic',
      note: 'The Hebrew and Aramaic text of the Koren Noé edition, shown and searched, downloaded via Sefaria.',
    },
    {
      ...KOREN,
      source: 'William Davidson Edition - English',
      note: 'The English of the Koren Noé edition, its translation in bold, downloaded via Sefaria.',
    },
    {
      source: 'Wikisource Talmud Bavli',
      url: SEFARIA_TALMUD,
      note: 'The Tanakh verse each quotation is from, read from the references in the Hebrew Wikisource text, downloaded via Sefaria.',
      collected: 'October 2026',
    },
  ],
  title(link) {
    const segment = link.square ? parseTalmudId(link.square) : null;
    return viewTitle(TALMUD_PAGE.name, segment && talmudRef(segment), link);
  },
};
