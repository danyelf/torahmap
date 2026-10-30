// How the Text Analytics measures see a verse: its words, and the stretches of them that are marked.
// Free of the page, so the script that writes the scores and the page that marks the text agree.

import { stripNikkud } from '@torahmap/hebrew';
import { wordsRead } from '../../search/dictionary.ts';

/** A verse's words without points or accents, so that two spellings with different points match. */
export function words(he: string): string[] {
  return wordsRead(he).map(({ word }) => stripNikkud(word));
}

/** The flagged stretches of a verse's words, as start, end pairs (end excluded) in one list. */
export function repeatedStretches(marks: boolean[]): number[] {
  const stretches: number[] = [];
  marks.forEach((marked, i) => {
    if (marked && !marks[i - 1]) stretches.push(i);
    if (marked && !marks[i + 1]) stretches.push(i + 1);
  });
  return stretches;
}

/**
 * The stretches of `verse` that sit in a run of at least `run` words some verse of `others` also
 * holds, in the form `repeatedStretches` gives.
 */
export function sharedStretches(verse: string[], others: string[][], run: number): number[] {
  const held = new Set(
    others.flatMap((other) =>
      Array.from({ length: Math.max(0, other.length - run + 1) }, (_, p) =>
        other.slice(p, p + run).join(' '),
      ),
    ),
  );
  const marks = verse.map(() => false);
  for (let p = 0; p + run <= verse.length; p++) {
    if (held.has(verse.slice(p, p + run).join(' '))) marks.fill(true, p, p + run);
  }
  return repeatedStretches(marks);
}
