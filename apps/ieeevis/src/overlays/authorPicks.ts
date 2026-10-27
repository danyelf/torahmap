// Which papers the picked authors wrote, and how to find an author by typing part of a name.
// No page in here.

import { memoByValue } from '@torahmap/utils';
import { plainName, type PickSettings } from '@torahmap/shell/overlays/picks.ts';
import type { Structure } from '../data.ts';

export interface AuthorData {
  structure: Structure;
}

export type AuthorSettings = PickSettings;

const QUICK_PICKS = 18;
const SUGGESTIONS = 6;

export interface Author {
  name: string;
  /** The name as compared with what is typed. */
  plain: string;
  papers: number;
}

/** Every author, with their papers' count, the most papers first. */
const authorsOf = memoByValue(({ structure }: AuthorData): Author[] => {
  const counts = new Map<string, number>();
  for (const day of structure.days)
    for (const session of day.sessions)
      for (const paper of session.papers)
        for (const name of new Set(paper.authors)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, papers]) => ({ name, plain: plainName(name), papers }))
    .sort((a, b) => b.papers - a.papers || a.name.localeCompare(b.name));
});

const byName = memoByValue(
  (data: AuthorData) => new Map(authorsOf(data).map((author) => [author.name, author])),
);

/** The picked authors in the order picked; names the program does not hold are dropped. */
export const pickedAuthors = (settings: AuthorSettings, data: AuthorData): Author[] =>
  settings.picked.flatMap((name) => byName(data).get(name) ?? []);

/** The authors with the most papers, to start from. */
export const quickPicks = (data: AuthorData): Author[] => authorsOf(data).slice(0, QUICK_PICKS);

/**
 * Authors whose name holds every word typed, those with a name starting with the typing before
 * the rest, each group with the most papers first.
 */
export function suggest(data: AuthorData, typed: string, skip: readonly Author[] = []): Author[] {
  const words = plainName(typed).split(' ').filter(Boolean);
  if (!words.length) return [];
  const starts = (author: Author) =>
    author.plain.startsWith(words[0]) ||
    author.plain.split(' ').some((w) => w.startsWith(words[0]));
  return authorsOf(data)
    .filter((author) => !skip.includes(author) && words.every((w) => author.plain.includes(w)))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)))
    .slice(0, SUGGESTIONS);
}

/** Which of `picked` wrote a paper whose authors are `names`, in the order picked. */
export const wroteIt = (picked: readonly Author[], names: readonly string[]): number[] =>
  picked.flatMap((author, i) => (names.includes(author.name) ? [i] : []));
