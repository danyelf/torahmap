// What the Talmud's site calls itself.

import type { Site } from '../app/text.ts';
import { parseTalmudId, talmudRef } from './layout.ts';

const NAME = 'Talmud Map';
const SEPARATOR = ' · ';

export const talmudSite: Site = {
  name: NAME,
  aboutHtml:
    '<p>An interactive visualization of the Babylonian Talmud. Every segment has a fixed position.</p>',
  credits: [
    {
      source: 'Wikisource Talmud Bavli',
      url: 'https://www.sefaria.org/texts/Talmud',
      note: 'The Hebrew and Aramaic text, from Hebrew Wikisource, downloaded via Sefaria.',
    },
  ],
  describe(link) {
    const segment = link.verse ? parseTalmudId(link.verse) : null;
    return {
      title: segment ? [talmudRef(segment), NAME].join(SEPARATOR) : NAME,
      description: '',
    };
  },
};
