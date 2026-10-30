// What the 2026 papers cite, read from the list of cited works. No page in here.

import { memoByValue } from '@torahmap/utils';
import type { CitedWork, Structure } from './data.ts';

export interface CitedData {
  structure: Structure;
  cited: CitedWork[];
}

/**
 * A cited work is picked and linked by its place in the list, which has no commas to break a
 * link's list of picks.
 */
export const workId = (place: number): string => String(place);

/** The names of what each paper cites, by paper `index`, from `namesOf` each cited work. */
function byPaper(
  cited: readonly CitedWork[],
  namesOf: (work: CitedWork, place: number) => readonly string[],
): Map<number, string[]> {
  const found = new Map<number, Set<string>>();
  cited.forEach((work, place) => {
    const names = namesOf(work, place);
    for (const paper of work.papers) {
      const set = found.get(paper) ?? found.set(paper, new Set()).get(paper)!;
      for (const name of names) set.add(name);
    }
  });
  return new Map([...found].map(([paper, names]) => [paper, [...names]]));
}

/** The people each paper cites, by paper `index`. */
export const peopleByPaper = memoByValue(({ cited }: CitedData) =>
  byPaper(cited, (work) => work.authors),
);

/** The works each paper cites, as ids, by paper `index`. */
export const worksByPaper = memoByValue(({ cited }: CitedData) =>
  byPaper(cited, (_, place) => [workId(place)]),
);

export const workTitle = ({ title, year }: CitedWork): string => `${title} (${year ?? 'n.d.'})`;

/** Who wrote a work: up to three names, then "et al." */
export const workAuthors = ({ authors }: CitedWork): string =>
  authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', ');

/** The works by `person` that the paper with this `index` cites, as titles with their years. */
export const worksOfPerson = ({ cited }: CitedData, person: string, paper: number): string[] =>
  cited.filter((w) => w.authors.includes(person) && w.papers.includes(paper)).map(workTitle);
