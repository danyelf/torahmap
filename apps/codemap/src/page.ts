// What the code map's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the code map's page is served, under the site's address. */
export const CODEMAP_PATH = '/codemap/';

const SUMMARY =
  'Code Map lays out every line of a repository as a colored bar, shaped by its indent and length, each in a fixed place.';

export const CODEMAP_PAGE: PageCopy = {
  name: 'Code Map',
  tagline: 'A map of every line of a repository.',
  url: `${ORIGIN}${CODEMAP_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: 'https://github.com/danyelf/torahmap',
  textSource: 'GitHub',
};
