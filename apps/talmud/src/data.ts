// The shapes of the Talmud data files in public/data/talmud/, and how to read them.

import type { Loaded } from '@torahmap/shell/dataFiles.ts';
import type { TextRange } from '@torahmap/utils';

/** The Talmud's folder in public/data/. */
export const TALMUD_DATA_DIR = 'talmud';

export const STRUCTURE_FILE = `${TALMUD_DATA_DIR}/structure.json`;

/** The file a tractate's text is in. */
export const textsFile = (tractate: string): string => `${TALMUD_DATA_DIR}/texts/${tractate}.json`;

/** The file a tractate's English is in, apart so that a reader of the Hebrew alone never downloads it. */
export const englishFile = (tractate: string): string =>
  `${TALMUD_DATA_DIR}/english/${tractate}.json`;

/** What search reads: the popup's text without points, each tractate's amudim of segments. */
export const SEARCH_FILE = `${TALMUD_DATA_DIR}/search.json`;

/** What English search reads, laid out as `SEARCH_FILE`. */
export const SEARCH_ENGLISH_FILE = `${TALMUD_DATA_DIR}/search-english.json`;

export interface TalmudAmud {
  daf: number;
  amud: 'a' | 'b';
  segmentCount: number;
  perekIdx: number;
  perekBoundaryAt?: number;
  mishnahMask: boolean[];
}

export interface TalmudPerek {
  hebrewName: string;
  startAmudIdx: number;
  endAmudIdx: number;
  startSegmentInFirstAmud: number;
  endSegmentInLastAmud: number;
}

export interface TalmudTractate {
  name: string;
  hebrewName: string;
  seder: string;
  /** From the first amud with text; an empty one inside the text stays, with no segments. */
  amudim: TalmudAmud[];
  perakim: TalmudPerek[];
}

export interface TalmudStructure {
  tractates: TalmudTractate[];
}

export interface TalmudTractateText {
  name: string;
  amudim: string[][];
  /** The Tanakh verses each segment cites, by its amud's place in `amudim` and its own. */
  citations: Record<number, Record<number, Citation[]>>;
  /** The same for the English, whose references name their verses: places in the segment's plain English. */
  englishCitations: Record<number, Record<number, Citation[]>>;
}

/** The William Davidson English, shaped as a tractate's `amudim`, in the markers `englishText` reads. */
export type TalmudTractateEnglish = string[][];

/** Each tractate's search text, shaped as its `amudim`. */
export type TalmudSearchText = Record<string, string[][]>;

/** Where a segment cites a Tanakh verse: the cited words, by place in its text, and the verse's id. */
export interface Citation extends TextRange {
  verse: string;
  /** Where no words of the segment quote the verse: the reference, shown at `start`, and `end` is `start`. */
  reference?: string;
}

export function structureFrom(loaded: Loaded): TalmudStructure {
  const structure = loaded.get(STRUCTURE_FILE) as TalmudStructure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}

/** Where an amud is among its tractate's, counting from `first`. */
export function amudIndex(
  daf: number,
  amud: 'a' | 'b',
  first: Pick<TalmudAmud, 'daf' | 'amud'>,
): number {
  const side = (a: 'a' | 'b') => (a === 'b' ? 1 : 0);
  return (daf - first.daf) * 2 + side(amud) - side(first.amud);
}

// False if the tractate/daf/amud/segment is unknown.
export function isSegmentMishnah(
  structure: TalmudStructure,
  tractateName: string,
  daf: number,
  amud: 'a' | 'b',
  segment: number,
): boolean {
  const tractate = structure.tractates.find((t) => t.name === tractateName);
  if (!tractate) return false;
  const amudEntry = tractate.amudim[amudIndex(daf, amud, tractate.amudim[0])];
  if (!amudEntry) return false;
  return amudEntry.mishnahMask[segment - 1] ?? false;
}

/** A tractate's hadran lines, the הדרן עלך that closes each perek: each perek's last segment. */
export function hadranLines(
  tractate: TalmudTractate,
): { daf: number; amud: 'a' | 'b'; segment: number }[] {
  return tractate.perakim.map((p) => {
    const { daf, amud } = tractate.amudim[p.endAmudIdx];
    return { daf, amud, segment: p.endSegmentInLastAmud };
  });
}
