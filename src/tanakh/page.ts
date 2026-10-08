// What the Tanakh's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN, SITE_NAME, TAGLINE } from '@torahmap/site';
import type { PageCopy } from '../app/page.ts';

export const TANAKH_PAGE: PageCopy = {
  name: SITE_NAME,
  tagline: TAGLINE,
  url: `${ORIGIN}/`,
  image: {
    url: `${ORIGIN}/og-image.jpg`,
    alt: 'The five books of the Torah above the first books of the Prophets, each verse a small square colored by how much commentary it has.',
  },
  noScript:
    'Torahmap lays out all 23,000 verses of the Hebrew Bible — Torah, Prophets and Writings — as colored squares, each in a fixed place, so that search results, commentary and haftarah readings show their patterns across the whole text.',
  noWebGl:
    'Torahmap lays out all 23,000 verses of the Hebrew Bible as colored squares, each in a fixed place.',
  textUrl: 'https://www.sefaria.org/texts/Tanakh',
};
