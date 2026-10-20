// What the Talmud's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the Talmud's page is served, under the site's address. */
export const TALMUD_PATH = '/talmud/';

export const SEFARIA_TALMUD = 'https://www.sefaria.org/texts/Talmud';

export const KOREN_TALMUD =
  'https://korenpub.co.il/collections/the-noe-edition-koren-talmud-bavli-1';

const SUMMARY =
  'Talmud Map lays out the Babylonian Talmud as colored squares, one for each segment, each in a fixed place.';

export const TALMUD_PAGE: PageCopy = {
  name: 'Talmud Map',
  tagline: 'A map of the Babylonian Talmud.',
  url: `${ORIGIN}${TALMUD_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: SEFARIA_TALMUD,
  textSource: 'Sefaria',
};
