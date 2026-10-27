/**
 * The verses that share a run of words, anywhere in the Tanakh. The runs and the stock phrases set
 * aside are the repetitive-wording measure's.
 */

import { formulas, runsIn, type ParsedBook } from './measures.ts';

/** For each verse, counted from the first verse of the first book, the positions of the verses it shares a run with. */
export function echoesAnywhere(books: ParsedBook[], stock = formulas(books)): number[][] {
  const verses = books.flatMap(({ verses }) => verses);
  const at = new Map<string, Set<number>>();
  verses.forEach((verse, v) =>
    runsIn(verse).forEach((run) => {
      if (stock.has(run)) return;
      if (!at.has(run)) at.set(run, new Set());
      at.get(run)!.add(v);
    }),
  );
  const echoes = verses.map(() => new Set<number>());
  for (const sharing of at.values()) {
    for (const a of sharing) for (const b of sharing) if (a !== b) echoes[a].add(b);
  }
  return echoes.map((set) => [...set].sort((a, b) => a - b));
}
