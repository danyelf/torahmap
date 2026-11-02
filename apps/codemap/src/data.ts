// The code map's data files in public/data/codemap/, which scripts/codemap writes, and their shapes.

import type { Loaded } from '@torahmap/shell/dataFiles.ts';

/** The code map's folder in public/data/. */
export const CODEMAP_DATA_DIR = 'codemap';

export const STRUCTURE_FILE = `${CODEMAP_DATA_DIR}/structure.json`;
export const TEXTS_FILE = `${CODEMAP_DATA_DIR}/texts.json`;

/** One character per line. */
export const LINE_KINDS = {
  b: 'blank',
  c: 'comment',
  i: 'import',
  h: 'function or class opening',
  x: 'code',
} as const;
export type LineKind = keyof typeof LINE_KINDS;

/** One character per head line: '.' untouched, 'a' added, 'c' changed. */
export interface Marks {
  marks: string;
  /** Head line numbers (1-based) just below each removal; one past the last line for a removal at the end. */
  deletedBefore: number[];
}

export interface CodeFile {
  path: string;
  /** Per head line, parallel arrays. */
  indent: number[];
  length: number[]; // columns to the end of the text, indent included, a tab counting 4
  kind: string; // LineKind per line
  lastChanged: number[]; // unix seconds, from git blame
  timesChanged: number[]; // over the file's whole history
  /** The pull request as a whole, then each of its commits in order. */
  pr: Marks;
  commits: Marks[];
  /** A file the pull request deleted: no lines, drawn as a stub, its deletion a removal before line 1. */
  deleted?: true;
}

export interface CodeStructure {
  repoUrl: string; // for links to a line, e.g. https://github.com/danyelf/torahmap
  base: string; // merge-base sha
  head: string;
  commits: { sha: string; subject: string }[];
  files: CodeFile[]; // sorted by path
}

/** Each file's lines, in the order of structure.files. */
export type CodeTexts = readonly (readonly string[])[];

export function structureFrom(loaded: Loaded): CodeStructure {
  const structure = loaded.get(STRUCTURE_FILE) as CodeStructure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}

/** What an overlay that reads the structure is handed. */
export interface StructureData {
  structure: CodeStructure;
}
export const STRUCTURE_DATA = { structure: STRUCTURE_FILE };
