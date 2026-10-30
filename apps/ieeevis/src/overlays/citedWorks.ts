// Lights every paper that cites the works a reader picks.

import { workAuthors, workTitle, worksByPaper, type CitedData } from '../citations.ts';
import { CITED_FILE, STRUCTURE_FILE } from '../data.ts';
import { listOverlay } from './listOverlay.ts';

export const citedWorksOverlay = listOverlay<CitedData>({
  id: 'citedworks',
  name: 'Cited works',
  urlKey: 'works',
  noun: { one: 'cited work', many: 'cited works' },
  description:
    'Lights every paper that cites the works you pick, each work in a color of its own; the rest of the map dims. A paper citing two of them is split between their colors.',
  data: { structure: STRUCTURE_FILE, cited: CITED_FILE },
  namesOf: (paper, data) => worksByPaper(data).get(paper.index) ?? [],
  popupLead: 'cites',
  label: (id, { cited }) => workTitle(cited[Number(id)]),
  detail: (id, { cited }) => workAuthors(cited[Number(id)]),
});
