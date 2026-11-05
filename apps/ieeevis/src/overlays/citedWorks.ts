// The citations view of works: lights every paper that cites the works a reader picks.

import { workAuthors, workTitle, worksAt, worksByPaper, type CitedData } from '../citations.ts';
import { CITED_DATA } from '../data.ts';
import { CITED_WORDING, listOverlay } from './listOverlay.ts';

export const citedWorksOverlay = listOverlay<CitedData>({
  id: 'citedworks',
  name: 'Cited works',
  urlKey: 'works',
  noun: { one: 'cited work', many: 'cited works' },
  data: CITED_DATA,
  namesOf: (paper, data) => worksByPaper(data).get(paper.index) ?? [],
  namesAt: (id, data) => worksAt(data).get(id) ?? [],
  titlesOf: (id, { cited }) => [cited[Number(id)].title],
  ...CITED_WORDING,
  label: (id, { cited }) => workTitle(cited[Number(id)]),
  detail: (id, { cited }) => workAuthors(cited[Number(id)]),
});
