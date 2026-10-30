// Which papers the picked authors, keywords, cited people or cited works belong to, and how to find one by typing part of
// its name. No page in here.

import { memoByValue } from '@torahmap/utils';
import { pickSlots, plainName, type PickSettings } from '@torahmap/shell/overlays/picks.ts';
import { papersOf, type Paper, type Structure } from '../data.ts';

export interface ListData {
  structure: Structure;
}

/** What names a kind of pick lists, and how each is shown. */
export interface PickSource<D extends ListData> {
  namesOf(paper: Paper, data: D): readonly string[];
  /** How a name is shown and matched; the name itself, as written, is still what is picked and linked. */
  label?(name: string, data: D): string;
  /** A line under the label: what else says which one it is. */
  detail?(name: string, data: D): string;
}

export type ListSettings = PickSettings;

const QUICK_PICKS = 18;
const SUGGESTIONS = 6;

/** What papers are listed under: one author, one keyword, one cited person or one cited work. */
export interface Entry {
  name: string;
  label: string;
  detail?: string;
  /** The label and detail as compared with what is typed. */
  plain: string;
  papers: number;
}

/** A picked entry and its place among the picks, which sets its colour. */
export type Picked = Entry & { slot: number };

/** The ways to find papers by what they list, for one kind of name. */
export interface Picks<D extends ListData> {
  /** Papers that list at least one name. */
  listing(data: D): { papers: number; total: number };
  /** The picked entries in the order picked; names no paper lists are dropped. */
  picked(settings: ListSettings, data: D): Picked[];
  /** The entries with the most papers, to start from. */
  quick(data: D): Entry[];
  /** Entries whose label or detail holds every word typed, those starting with the typing first. */
  suggest(data: D, typed: string, skip?: readonly Entry[]): Entry[];
}

export function picksOf<D extends ListData>(source: PickSource<D>): Picks<D> {
  const { namesOf } = source;
  const entries = memoByValue((data: D): Entry[] => {
    const counts = new Map<string, number>();
    for (const paper of papersOf(data.structure))
      for (const name of new Set(namesOf(paper, data)))
        counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts]
      .map(([name, papers]) => {
        const label = source.label?.(name, data) ?? name;
        const detail = source.detail?.(name, data);
        return { name, label, detail, plain: plainName(`${label} ${detail ?? ''}`), papers };
      })
      .sort((a, b) => b.papers - a.papers || a.label.localeCompare(b.label));
  });
  const byName = memoByValue(
    (data: D) => new Map(entries(data).map((entry) => [entry.name, entry])),
  );
  return {
    listing: (data) => {
      const all = papersOf(data.structure);
      return {
        papers: all.filter((paper) => namesOf(paper, data).length > 0).length,
        total: all.length,
      };
    },
    picked: (settings, data) =>
      pickSlots(settings, (name) => byName(data).has(name)).map(({ id, slot }) => ({
        ...byName(data).get(id)!,
        slot,
      })),
    quick: (data) => entries(data).slice(0, QUICK_PICKS),
    suggest(data, typed, skip = []) {
      const words = plainName(typed).split(' ').filter(Boolean);
      if (!words.length) return [];
      const starts = (entry: Entry) => entry.plain.split(' ').some((w) => w.startsWith(words[0]));
      return entries(data)
        .filter(
          (entry) =>
            !skip.some((s) => s.name === entry.name) && words.every((w) => entry.plain.includes(w)),
        )
        .sort((a, b) => Number(starts(b)) - Number(starts(a)))
        .slice(0, SUGGESTIONS);
    },
  };
}

/** Which of `picked` are among `names`, as places in `picked`. */
export const listedBy = (picked: readonly Entry[], names: readonly string[]): number[] =>
  picked.flatMap((entry, i) => (names.includes(entry.name) ? [i] : []));
