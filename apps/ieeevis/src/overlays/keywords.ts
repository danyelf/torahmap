// Lights every paper that lists the keywords a reader picks.

import { STRUCTURE_FILE } from '../data.ts';
import { listOverlay } from './listOverlay.ts';
import { titleCase } from './titleCase.ts';

export const keywordsOverlay = listOverlay({
  id: 'keywords',
  name: 'Keywords',
  urlKey: 'keywords',
  noun: { one: 'keyword', many: 'keywords' },
  description:
    'Lights every paper that lists the keywords you pick, each keyword in a color of its own; the rest of the map dims. A paper with two of them is split between their colors. Not every paper lists keywords.',
  data: { structure: STRUCTURE_FILE },
  namesOf: (paper) => paper.keywords ?? [],
  label: titleCase,
  legendNote: ({ papers, total }) => `${papers} of ${total} papers list keywords`,
});
