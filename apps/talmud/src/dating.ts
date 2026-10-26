// The shape of public/data/talmud/dating.json: which rabbis each segment names, who each name can
// be, and their generations.

import { TALMUD_DATA_DIR } from './data.ts';

export const DATING_FILE = `${TALMUD_DATA_DIR}/dating.json`;

/** A generation of rabbis, with the years Sefaria gives it (negative for BCE). */
export interface Generation {
  code: string;
  from: number;
  to: number;
}

/** A name a segment lists. `gen` is a place in `generations`: the latest candidate's, for a shared name. */
export interface Person {
  /** Its Sefaria slug. */
  id: string;
  en: string;
  he: string;
  gen: number;
  /** The places in `rabbis` of the people it can mean. */
  means: number[];
}

/** A name is certain when it can mean only one person. */
export const isSure = ({ means }: { means: readonly unknown[] }) => means.length === 1;

/** The `gen` of a rabbi Sefaria gives no generation. */
export const UNDATED = 'undated';

export interface Rabbi {
  /** His Sefaria slug. */
  id: string;
  en: string;
  he: string;
  /** A generation's code, or `UNDATED`. */
  gen: string;
  /** Every name Sefaria records for him, and those of the shared names that can mean him. */
  names: string[];
}

/** A segment: its generation, whether only a shared name gives it, its people (places in `people`), and spans in its Hebrew: start, end, person, repeated. */
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
  /** Everyone a name in `people` can mean, by id. */
  rabbis: Rabbi[];
  /** By segment id; a segment that dates nothing is absent. */
  segments: Record<string, DatedSegment>;
}
