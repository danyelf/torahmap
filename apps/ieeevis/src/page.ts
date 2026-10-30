// What the IEEE VIS map's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the VIS page is served, under the site's address. */
export const IEEEVIS_PATH = '/ieeevis/';

/** Where the VIS map is meant to live; its link preview's picture is served from here. */
export const IEEEVIS_ORIGIN = 'https://ieeevis.torahmap.org';

const SUMMARY =
  'VIS Map lays out the IEEE VIS 2026 program as colored squares, one for each quarter page of a paper, each in a fixed place.';

export const IEEEVIS_PAGE: PageCopy = {
  name: 'VIS Map',
  tagline: 'A map of the IEEE VIS 2026 program.',
  url: `${ORIGIN}${IEEEVIS_PATH}`,
  image: {
    url: `${IEEEVIS_ORIGIN}/ieeevis-og-image.jpg`,
    alt: 'Four days of the IEEE VIS 2026 program laid out in columns, each paper a block of small squares colored by its kind.',
  },
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: 'https://ieeevis.org/',
  textSource: 'IEEE VIS',
};
