import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { COLORTESTBED_PAGE } from './page.ts';

export const colortestbedSite: Site = {
  page: COLORTESTBED_PAGE,
  direction: 'ltr',
  squareName: 'square',
  aboutHtml:
    '<p>A made-up text for judging colour. Each row is a palette (edit <code>apps/colortestbed/src/palettes.ts</code>); each column is a block size. Zoom to 0.25 and 0.22 to look for moiré.</p>',
  credits: [],
  title(link) {
    return viewTitle(COLORTESTBED_PAGE.name, link.square ?? null, link);
  },
};
