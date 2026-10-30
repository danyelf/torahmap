// Lights every paper whose references name the people a reader picks.

import { peopleByPaper, worksOfPerson, type CitedData } from '../citations.ts';
import { CITED_FILE, STRUCTURE_FILE } from '../data.ts';
import { listOverlay } from './listOverlay.ts';

/** Most of a person's works the popup lists before it says how many more. */
const LISTED = 4;

export const citedPeopleOverlay = listOverlay<CitedData>({
  id: 'citedpeople',
  name: 'Cited people',
  urlKey: 'people',
  noun: { one: 'cited person', many: 'cited people' },
  description:
    'Lights every paper whose references name the people you pick, each person in a color of their own; the rest of the map dims. A paper citing two of them is split between their colors. Names as written in references can stand for more than one person.',
  data: { structure: STRUCTURE_FILE, cited: CITED_FILE },
  namesOf: (paper, data) => peopleByPaper(data).get(paper.index) ?? [],
  popupLead: 'cites',
  popupDetail(paper, person, data) {
    const works = worksOfPerson(data, person, paper.index);
    return works.length > LISTED
      ? [...works.slice(0, LISTED), `and ${works.length - LISTED} more`]
      : works;
  },
});
