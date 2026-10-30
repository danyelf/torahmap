// What the 2026 papers cite, read from the list of cited works. No page in here.

import { memoByValue } from '@torahmap/utils';
import { papersOf, type CitedWork, type Structure } from './data.ts';
import { pieceId } from './layout.ts';

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

/**
 * What names the squares: for each square id, the names of the cited works found in its text. A
 * paper whose text the work was not found in has it on every square.
 */
function bySquare(
  { cited, structure }: CitedData,
  namesOf: (work: CitedWork, place: number) => readonly string[],
): Map<string, string[]> {
  const found = new Map<string, Set<string>>();
  const lengths = new Map(papersOf(structure).map((p) => [p.index, p.pieces.length]));
  const piecesOfPaper = (paper: number) =>
    Array.from({ length: lengths.get(paper) ?? 0 }, (_, n) => n);
  cited.forEach((work, place) => {
    const names = namesOf(work, place);
    work.papers.forEach((paper, i) => {
      const holding = work.pieces[i] ?? [];
      for (const piece of holding.length ? holding : piecesOfPaper(paper)) {
        const id = pieceId(paper, piece);
        const set = found.get(id) ?? found.set(id, new Set()).get(id)!;
        for (const name of names) set.add(name);
      }
    });
  });
  return new Map([...found].map(([id, names]) => [id, [...names]]));
}

/** The people whose works each square's text cites, by square id. */
export const peopleAt = memoByValue((data: CitedData) => bySquare(data, (work) => work.authors));

/** The works each square's text cites, as ids, by square id. */
export const worksAt = memoByValue((data: CitedData) =>
  bySquare(data, (_, place) => [workId(place)]),
);

/** The titles of the works by each person. */
export const titlesByPerson = memoByValue(({ cited }: CitedData) => {
  const titles = new Map<string, string[]>();
  for (const work of cited)
    for (const author of work.authors)
      titles.set(author, [...(titles.get(author) ?? []), work.title]);
  return titles;
});

const wordsOf = (title: string): string[] => title.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * The reference entries in `text` that are one of `titles`: each from its "[n]" or its line to the
 * next entry. A title is matched as the scrape matches it: whole words, in any case and punctuation,
 * after NFKC normalisation.
 */
export function entriesOf(
  text: string,
  titles: readonly string[],
): { start: number; end: number }[] {
  // Normalising keeps each letter's place unless a character expands, then the text is read as it is.
  const normal = text.normalize('NFKC');
  const haystack = normal.length === text.length ? normal : text;
  const found: { start: number; end: number }[] = [];
  for (const title of titles) {
    const words = wordsOf(title);
    if (!words.length) continue;
    const hit = new RegExp(
      `(?<![\\p{L}\\p{N}])${words.join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`,
      'iu',
    ).exec(haystack);
    if (!hit) continue;
    const before = text.slice(0, hit.index);
    const lineStart = before.lastIndexOf('\n') + 1;
    const numbered = [...before.matchAll(/\[\d+\]\s/g)].pop()?.index ?? -1;
    const after = text.slice(hit.index + hit[0].length);
    const next = after.search(/\n|\s\[\d+\]\s/);
    found.push({
      start: Math.max(lineStart, numbered),
      end: hit.index + hit[0].length + (next < 0 ? after.length : next),
    });
  }
  return found.sort((a, b) => a.start - b.start);
}
