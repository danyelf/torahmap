// Which papers the picked authors or keywords belong to, and how to find one by typing part of
// its name. No page in here.

import { memoByValue } from '@torahmap/utils';
import { plainName, type PickSettings } from '@torahmap/shell/overlays/picks.ts';
import type { Paper, Structure } from '../data.ts';

export interface ListData {
  structure: Structure;
}

export type ListSettings = PickSettings;

const QUICK_PICKS = 18;
const SUGGESTIONS = 6;

/** What papers are listed under: one author, or one keyword. */
export interface Entry {
  name: string;
  /** The name as compared with what is typed. */
  plain: string;
  papers: number;
}

/** The ways to find papers by what they list, for one kind of name. */
export interface Picks {
  /** Papers that list at least one name. */
  listing(data: ListData): { papers: number; total: number };
  /** The picked entries in the order picked; names no paper lists are dropped. */
  picked(settings: ListSettings, data: ListData): Entry[];
  /** The entries with the most papers, to start from. */
  quick(data: ListData): Entry[];
  /** Entries whose name holds every word typed, those starting with the typing first. */
  suggest(data: ListData, typed: string, skip?: readonly Entry[]): Entry[];
}

export const papersOf = ({ structure }: ListData): Paper[] =>
  structure.days.flatMap((day) => day.sessions.flatMap((session) => session.papers));

export function picksOf(namesOf: (paper: Paper) => readonly string[]): Picks {
  const entries = memoByValue((data: ListData): Entry[] => {
    const counts = new Map<string, number>();
    for (const paper of papersOf(data))
      for (const name of new Set(namesOf(paper))) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts]
      .map(([name, papers]) => ({ name, plain: plainName(name), papers }))
      .sort((a, b) => b.papers - a.papers || a.name.localeCompare(b.name));
  });
  const byName = memoByValue(
    (data: ListData) => new Map(entries(data).map((entry) => [entry.name, entry])),
  );
  return {
    listing: (data) => {
      const all = papersOf(data);
      return { papers: all.filter((paper) => namesOf(paper).length > 0).length, total: all.length };
    },
    picked: (settings, data) => settings.picked.flatMap((name) => byName(data).get(name) ?? []),
    quick: (data) => entries(data).slice(0, QUICK_PICKS),
    suggest(data, typed, skip = []) {
      const words = plainName(typed).split(' ').filter(Boolean);
      if (!words.length) return [];
      const starts = (entry: Entry) => entry.plain.split(' ').some((w) => w.startsWith(words[0]));
      return entries(data)
        .filter((entry) => !skip.includes(entry) && words.every((w) => entry.plain.includes(w)))
        .sort((a, b) => Number(starts(b)) - Number(starts(a)))
        .slice(0, SUGGESTIONS);
    },
  };
}

/** Which of `picked` are among `names`, as places in `picked`. */
export const listedBy = (picked: readonly Entry[], names: readonly string[]): number[] =>
  picked.flatMap((entry, i) => (names.includes(entry.name) ? [i] : []));
