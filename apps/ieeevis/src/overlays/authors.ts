// Lights every paper by the authors a reader picks.

import { listOverlay } from './listOverlay.ts';

export const AUTHORS_ID = 'authors';

const { overlay, urlParams } = listOverlay({
  id: AUTHORS_ID,
  name: 'Authors',
  urlKey: 'authors',
  noun: { one: 'author', many: 'authors', a: 'an author' },
  description:
    'Lights every paper by the authors you pick, each author in a color of their own; the rest of the map dims. A paper by two of them is split between their colors.',
  namesOf: (paper) => paper.authors,
});

export const authorsOverlay = overlay;
export const AUTHORS_URL_PARAMS = urlParams;
