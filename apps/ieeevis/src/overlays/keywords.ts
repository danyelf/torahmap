// Lights every paper that lists the keywords a reader picks.

import { listOverlay } from './listOverlay.ts';
import { titleCase } from './titleCase.ts';

export const keywordsOverlay = listOverlay({
  id: 'keywords',
  name: 'Keywords',
  urlKey: 'keywords',
  noun: { one: 'keyword', many: 'keywords', a: 'a keyword' },
  description:
    'Lights every paper that lists the keywords you pick, each keyword in a color of its own; the rest of the map dims. A paper with two of them is split between their colors. Not every paper lists keywords.',
  namesOf: (paper) => paper.keywords ?? [],
  display: titleCase,
  legendNote: ({ papers, total }) => `${papers} of ${total} papers list keywords`,
});
