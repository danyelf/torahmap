// The citations view of people: lights the squares whose text cites works by the people a reader picks.

import { peopleAt, peopleByPaper, titlesByPerson, type CitedData } from '../citations.ts';
import { CITED_FILE, STRUCTURE_FILE } from '../data.ts';
import { listOverlay } from './listOverlay.ts';

export const citedPeopleOverlay = listOverlay<CitedData>({
  id: 'citedpeople',
  name: 'Cited people',
  urlKey: 'people',
  noun: { one: 'cited person', many: 'cited people' },
  data: { structure: STRUCTURE_FILE, cited: CITED_FILE },
  namesOf: (paper, data) => peopleByPaper(data).get(paper.index) ?? [],
  namesAt: (item, data) => peopleAt(data).get(item.id) ?? [],
  titlesOf: (person, data) => titlesByPerson(data).get(person) ?? [],
  popupLead: 'cites',
});
