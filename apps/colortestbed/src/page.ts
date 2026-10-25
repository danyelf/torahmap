// What the colour testbed's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the testbed's page is served, under the site's address. */
export const COLORTESTBED_PATH = '/colors/';

const SUMMARY =
  'Colour Testbed shows palettes as blocks of squares at every size, to judge colours at every zoom.';

export const COLORTESTBED_PAGE: PageCopy = {
  name: 'Colour Testbed',
  tagline: 'Palettes as squares, to judge colour at every zoom.',
  url: `${ORIGIN}${COLORTESTBED_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: ORIGIN,
  textSource: 'Torah Map',
};
