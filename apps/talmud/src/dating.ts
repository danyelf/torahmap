// The shape of public/data/talmud/dating.json: which rabbis each segment names, and their generations.

import { TALMUD_DATA_DIR } from './data.ts';

export const DATING_FILE = `${TALMUD_DATA_DIR}/dating.json`;

/** A generation of rabbis, with the years Sefaria gives it (negative for BCE). */
export interface Generation {
  code: string;
  /** "Amoraim, 4th generation" */
  name: string;
  from: number;
  to: number;
}

/** A rabbi, or a name that could be several; `gen` is a place in `generations` (the latest candidate's, for such a name). */
export interface Person {
  en: string;
  he: string;
  gen: number;
  ambiguous?: true;
}

/**
 * A segment's latest generation, whether only an ambiguous name gives it, the people (places in
 * `people`) behind it in the order they are named, and where its Hebrew names them: a start, an end
 * and a person, again and again.
 */
export type DatedSegment = [
  generation: number,
  uncertain: 0 | 1,
  people: number[],
  spans: number[],
];

export interface TalmudDating {
  /** Those that occur, earliest first. */
  generations: Generation[];
  people: Person[];
  /** By segment id; a segment that dates nothing is absent. */
  segments: Record<string, DatedSegment>;
}
