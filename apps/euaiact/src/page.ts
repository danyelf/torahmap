// What the AI Act's page says before the map runs. Imported by the Vite config, so it imports no app code.

import { ORIGIN } from '@torahmap/site';
import type { PageCopy } from '@torahmap/shell/app/page.ts';

/** Where the Act's page is served, under the site's address. */
export const EUAIACT_PATH = '/euaiact/';

/** The Act on EUR-Lex, where each square's source lives. */
export const EUR_LEX = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng';

const SUMMARY =
  'AI Act Map lays out the EU Artificial Intelligence Act as colored squares, one for each paragraph, each in a fixed place.';

export const EUAIACT_PAGE: PageCopy = {
  name: 'AI Act Map',
  tagline: 'A map of the EU Artificial Intelligence Act.',
  url: `${ORIGIN}${EUAIACT_PATH}`,
  noScript: SUMMARY,
  noWebGl: SUMMARY,
  textUrl: EUR_LEX,
};
