// What the Talmud's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '../app/page.ts';

export const SEFARIA_TALMUD = 'https://www.sefaria.org/texts/Talmud';

const SUMMARY =
  'Talmud Map lays out the Babylonian Talmud as colored squares, one for each segment, each in a fixed place.';

export const TALMUD_PAGE: PageCopy = {
  name: 'Talmud Map',
  tagline: 'A map of the Babylonian Talmud.',
  url: `${ORIGIN}/talmud/`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: SEFARIA_TALMUD,
};
