// What the IEEE VIS map's page says before the map runs. Imported by the Vite config, so it imports no app code.

import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the VIS page is served, under the site's address. */
export const IEEEVIS_PATH = '/ieeevis/';

/** Where the VIS map lives, at the root; its link preview's picture is served from here. */
export const IEEEVIS_ORIGIN = 'https://ieeevis.danyelfisher.info';

/** IEEE VIS's own icon, in the tab and beside the map's title. */
export const IEEEVIS_ICON = '/ieeevis-icon.svg';

/** About how many words of a paper one square holds, as the scrape cuts them. */
export const WORDS_PER_SQUARE = 250;

const SUMMARY = `VIS Map lays out the IEEE VIS 2026 program as colored squares, each about ${WORDS_PER_SQUARE} words of a paper, each in a fixed place.`;

export const IEEEVIS_PAGE: PageCopy = {
  name: 'VIS Map',
  icon: IEEEVIS_ICON,
  tagline: 'A map of the IEEE VIS 2026 program.',
  url: `${IEEEVIS_ORIGIN}/`,
  image: {
    url: `${IEEEVIS_ORIGIN}/ieeevis-og-image.jpg`,
    alt: 'The IEEE VIS 2026 program laid out in columns by day, each paper a block of small squares colored by its kind.',
  },
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: 'https://ieeevis.org/year/2026/',
  textSource: 'IEEE VIS',
};
