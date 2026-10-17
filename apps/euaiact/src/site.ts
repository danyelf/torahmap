// What the AI Act's site calls itself.

import { viewTitle } from '@torahmap/site';
import type { Site } from '@torahmap/shell/app/text.ts';
import { actRef } from './ids.ts';
import { EUAIACT_PAGE, EUR_LEX } from './page.ts';

export const euaiactSite: Site = {
  page: EUAIACT_PAGE,
  direction: 'ltr',
  squareName: 'paragraph',
  hasHebrew: false,
  aboutHtml:
    '<p>An interactive visualization of the EU Artificial Intelligence Act, as amended in 2026. Every paragraph has a fixed position: recitals above, articles in the middle, annexes below.</p>',
  credits: [
    {
      source: 'EUR-Lex',
      url: EUR_LEX,
      note: 'Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744: the consolidated text of 27 July 2026, and the 2024 Official Journal text for the recitals.',
      collected: 'October 2026',
    },
  ],
  title(link) {
    return viewTitle(EUAIACT_PAGE.name, link.square ? actRef(link.square) : null, link);
  },
};
