// Lights every paper by the authors a reader picks.

import { STRUCTURE_FILE } from '../data.ts';
import { listOverlay } from './listOverlay.ts';

export const authorsOverlay = listOverlay({
  id: 'authors',
  name: 'Authors',
  urlKey: 'authors',
  noun: { one: 'author', many: 'authors' },
  description:
    'Lights every paper by the authors you pick, each author in a color of their own; the rest of the map dims. A paper by two of them is split between their colors.',
  data: { structure: STRUCTURE_FILE },
  namesOf: (paper) => paper.authors,
});
