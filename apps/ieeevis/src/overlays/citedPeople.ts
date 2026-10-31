// The citations view of people: lights the squares whose text cites works by the people a reader picks.

import { peopleAt, peopleByPaper, titlesByPerson, type CitedData } from '../citations.ts';
import { CITED_DATA } from '../data.ts';
import { listOverlay } from './listOverlay.ts';

export const citedPeopleOverlay = listOverlay<CitedData>({
  id: 'citedpeople',
  name: 'Cited people',
  urlKey: 'people',
  noun: { one: 'cited person', many: 'cited people' },
  data: CITED_DATA,
  namesOf: (paper, data) => peopleByPaper(data).get(paper.index) ?? [],
  namesAt: (item, data) => peopleAt(data).get(item.id) ?? [],
  titlesOf: (person, data) => titlesByPerson(data).get(person) ?? [],
  popupLead: 'cites',
  countLead: 'cited by',
  quickHeading: 'Most cited',
});
