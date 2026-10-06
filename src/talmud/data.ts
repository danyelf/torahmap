// The shapes of the Talmud data files in public/data/talmud/, and how to read them.

import type { Loaded } from '../dataFiles.ts';

export const STRUCTURE_FILE = 'talmud/structure.json';

/** The file a tractate's text is in. */
export const textsFile = (tractate: string): string => `talmud/texts/${tractate}.json`;

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
  firstDaf: number;
  amudim: TalmudAmud[];
  perakim: TalmudPerek[];
}

export interface TalmudStructure {
  tractates: TalmudTractate[];
}

export interface TalmudTractateText {
  name: string;
  amudim: string[][];
}

export function structureFrom(loaded: Loaded): TalmudStructure {
  const structure = loaded.get(STRUCTURE_FILE) as TalmudStructure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}

/** Where an amud is among its tractate's: 2a is the first in a tractate whose first daf is 2. */
export function amudIndex(daf: number, amud: 'a' | 'b', firstDaf: number): number {
  return (daf - firstDaf) * 2 + (amud === 'b' ? 1 : 0);
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
  const amudEntry = tractate.amudim[amudIndex(daf, amud, tractate.firstDaf)];
  if (!amudEntry) return false;
  return amudEntry.mishnahMask[segment - 1] ?? false;
}
