// What the code map's site calls itself.

import { MAKER_EMAIL, viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { CODEMAP_PAGE } from './page.ts';

export const codemapSite: Site = {
  page: CODEMAP_PAGE,
  direction: 'ltr',
  squareName: 'line',
  email: MAKER_EMAIL,
  aboutHtml: `<p>${CODEMAP_PAGE.noScript} Color a line by what the pull request did to it, as a whole or one commit at a time; by how recently or how often it has changed over its file’s history; by what kind of line it is; or by what kind of file it is in. The data comes from git alone: whether a line was changed rather than removed and added is a reading of the diff, usually right.</p>`,
  credits: [],
  title(link) {
    return viewTitle(CODEMAP_PAGE.name, link.square ?? null, link);
  },
};
