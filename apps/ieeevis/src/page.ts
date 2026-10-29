// What the IEEE VIS map's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the VIS page is served, under the site's address. */
export const IEEEVIS_PATH = '/ieeevis/';

const SUMMARY =
  'VIS Map lays out the IEEE VIS 2026 program as colored squares, one for each quarter page of a paper, each in a fixed place.';

export const IEEEVIS_PAGE: PageCopy = {
  name: 'VIS Map',
  tagline: 'A map of the IEEE VIS 2026 program.',
  noindex: true,
  url: `${ORIGIN}${IEEEVIS_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: 'https://ieeevis.org/',
  textSource: 'IEEE VIS',
};
