// Lights every paper that lists the keywords a reader picks.

import { listOverlay } from './listOverlay.ts';

export const KEYWORDS_ID = 'keywords';

const { overlay, urlParams } = listOverlay({
  id: KEYWORDS_ID,
  name: 'Keywords',
  urlKey: 'keywords',
  noun: { one: 'keyword', many: 'keywords', a: 'a keyword' },
  description:
    'Lights every paper that lists the keywords you pick, each keyword in a color of its own; the rest of the map dims. A paper with two of them is split between their colors. Not every paper lists keywords.',
  namesOf: (paper) => paper.keywords ?? [],
  legendNote: ({ papers, total }) => `${papers} of ${total} papers list keywords`,
});

export const keywordsOverlay = overlay;
export const KEYWORDS_URL_PARAMS = urlParams;
