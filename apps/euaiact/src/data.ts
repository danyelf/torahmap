// The Act's data files in public/data/euaiact/, which scripts/euaiact/bundle.py writes, and their shapes.

import type { Loaded } from '@torahmap/shell/dataFiles.ts';

/** The Act's folder in public/data/. */
export const EUAIACT_DATA_DIR = 'euaiact';

export const STRUCTURE_FILE = `${EUAIACT_DATA_DIR}/structure.json`;
export const TEXTS_FILE = `${EUAIACT_DATA_DIR}/texts.json`;
export const REFS_FILE = `${EUAIACT_DATA_DIR}/refs.json`;

/** Where a paragraph comes from: the Act as passed, or the 2026 amendment. */
export type Origin = 'B' | 'M1 inserted' | 'M1 replaced';

export interface ActCell {
  id: string;
  origin: Origin;
}

/** A plain paragraph, or a list: its lead-in (null when it has no sentence of its own) and its points. */
export type ActGroup =
  { kind: 'plain'; cell: ActCell } | { kind: 'list'; lead: ActCell | null; points: ActCell[] };

/** An article, or a part of an annex. */
export interface ActBlock {
  number: string;
  groups: ActGroup[];
}

/** A column of blocks; `runs` are separated by a section gap. `label` names a split chapter's section. */
export interface ActColumn {
  label: string | null;
  runs: ActBlock[][];
}

export interface ActChapter {
  number: string;
  columns: ActColumn[];
}

export interface ActAnnex {
  number: string;
  blocks: ActBlock[];
}

export interface ActStructure {
  recitals: number;
  chapters: ActChapter[];
  annexes: ActAnnex[];
}

export type ActTexts = Readonly<Record<string, string>>;

/** [from, to]: a square cites an article, paragraph, point or whole annex ("Annex III"). */
export type ActRef = readonly [string, string];

export function structureFrom(loaded: Loaded): ActStructure {
  const structure = loaded.get(STRUCTURE_FILE) as ActStructure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}
