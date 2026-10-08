// What the Talmud's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '../app/text.ts';
import { parseTalmudId, talmudRef } from './layout.ts';

const NAME = 'Talmud Map';

export const talmudSite: Site = {
  name: NAME,
  squareName: 'segment',
  aboutHtml:
    '<p>An interactive visualization of the Babylonian Talmud. Every segment has a fixed position.</p>',
  credits: [
    {
      source: 'Wikisource Talmud Bavli',
      url: 'https://www.sefaria.org/texts/Talmud',
      note: 'The Hebrew and Aramaic text, from Hebrew Wikisource, downloaded via Sefaria.',
    },
  ],
  title(link) {
    const segment = link.square ? parseTalmudId(link.square) : null;
    return viewTitle(NAME, segment && talmudRef(segment), link);
  },
  page: {
    tagline: 'A map of the Babylonian Talmud.',
    url: 'https://torahmap.org/talmud/',
    noScript:
      'Talmud Map lays out the Babylonian Talmud as colored squares, one for each segment, each in a fixed place.',
    noWebGl:
      'Talmud Map lays out the Babylonian Talmud as colored squares, one for each segment, each in a fixed place.',
    textUrl: 'https://www.sefaria.org/texts/Talmud',
  },
};
