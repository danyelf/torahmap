// The shapes of the Talmud data files in public/data/talmud/.

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
  const amudIdx = (daf - tractate.firstDaf) * 2 + (amud === 'b' ? 1 : 0);
  const amudEntry = tractate.amudim[amudIdx];
  if (!amudEntry) return false;
  return amudEntry.mishnahMask[segment - 1] ?? false;
}
