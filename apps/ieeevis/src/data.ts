// The program's data files in public/data/ieeevis/, which scripts/ieeevis/build.py writes, and their shapes.

import type { Loaded } from '@torahmap/shell/dataFiles.ts';

/** The program's folder in public/data/. */
export const IEEEVIS_DATA_DIR = 'ieeevis';

export const STRUCTURE_FILE = `${IEEEVIS_DATA_DIR}/structure.json`;
/** The papers' text by square id. Not in git: the papers' copyright varies. */
export const TEXTS_FILE = `${IEEEVIS_DATA_DIR}/texts.json`;

/**
 * What a piece of a paper is: a abstract, i introduction, r related work, m method,
 * e evaluation, d discussion, c conclusion, f references, o other, x no text.
 */
export type Section = 'a' | 'i' | 'r' | 'm' | 'e' | 'd' | 'c' | 'f' | 'o' | 'x';

export interface Paper {
  index: number;
  title: string;
  authors: string[];
  kind: string;
  /** "Wed, Nov 11, 13:00", or empty when the program gives no time. */
  when: string;
  /** One section letter per piece. */
  pieces: string;
}

export interface Session {
  name: string;
  papers: Paper[];
}

export interface Day {
  name: string;
  sessions: Session[];
}

export interface Structure {
  days: Day[];
}

export type PaperTexts = Readonly<Record<string, string>>;

export function structureFrom(loaded: Loaded): Structure {
  const structure = loaded.get(STRUCTURE_FILE) as Structure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}
