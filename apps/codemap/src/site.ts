// What the code map's site calls itself.

import { MAKER_EMAIL, viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { CODEMAP_PAGE } from './page.ts';

export const codemapSite: Site = {
  page: CODEMAP_PAGE,
  direction: 'ltr',
  squareName: 'line',
  email: MAKER_EMAIL,
  aboutHtml:
    '<p>An interactive map of a pull request. Every line of the repository is a bar, shaped by its indent and length, and keeps its place whatever is shown.</p>',
  credits: [],
  title(link) {
    return viewTitle(CODEMAP_PAGE.name, link.square ?? null, link);
  },
};
