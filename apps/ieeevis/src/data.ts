// The program's data files in public/data/ieeevis/, which the ieeevis-scrape project's build.py
// writes, and their shapes.

import type { Loaded } from '@torahmap/shell/dataFiles.ts';

/** The program's folder in public/data/. */
export const IEEEVIS_DATA_DIR = 'ieeevis';

export const STRUCTURE_FILE = `${IEEEVIS_DATA_DIR}/structure.json`;
/** The papers' text by square id, packed (utils/packed.ts). Not in git. */
export const TEXTS_FILE = `${IEEEVIS_DATA_DIR}/p.bin`;
/** The works the 2026 papers cite, each with the papers that cite it. */
export const CITED_FILE = `${IEEEVIS_DATA_DIR}/cited.json`;
/** The files the citations views read. */
export const CITED_DATA = { structure: STRUCTURE_FILE, cited: CITED_FILE };

/**
 * What a piece of a paper is, by letter: abstract, introduction, related work, method,
 * evaluation, discussion, conclusion, references, other, or x for no text at all.
 */
export type Section = 'a' | 'i' | 'r' | 'm' | 'e' | 'd' | 'c' | 'f' | 'o' | 'x';
/** The section holding a paper's reference list. */
export const REFERENCES_SECTION: Section = 'f';

export interface Paper {
  index: number;
  title: string;
  authors: string[];
  /** The keywords the program lists for it; absent when it lists none. */
  keywords?: string[];
  kind: string;
  /** "Wed, Nov 11, 13:00", or empty when the program gives no time. */
  when: string;
  /** One section letter per piece. */
  pieces: string;
  /** The paper's own page on the VIS site. */
  page: string;
}

/** A work cited by one or more 2026 papers. */
export interface CitedWork {
  title: string;
  /** Null when the reference gives none. */
  year: number | null;
  /** Empty when the reference names none. */
  authors: string[];
  /** The `index` of each paper that cites it. */
  papers: number[];
  /** Parallel to `papers`: which pieces of that paper hold the work; none when it was not found in the text. */
  pieces: number[][];
}

export interface Session {
  name: string;
  /** When its first paper starts, "10:00", or empty when the program gives no time. */
  start: string;
  papers: Paper[];
}

export interface Day {
  name: string;
  sessions: Session[];
}

/** The sessions of a day that start together. */
export interface TimeSlot {
  /** "10:00", or empty when the program gives no time. */
  start: string;
  sessions: Session[];
}

/** A day's sessions grouped by start time, in program order. */
export function timeSlotsOf({ sessions }: Day): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (const session of sessions) {
    const last = slots[slots.length - 1];
    if (last && last.start === session.start) last.sessions.push(session);
    else slots.push({ start: session.start, sessions: [session] });
  }
  return slots;
}

export interface Structure {
  days: Day[];
}

export const papersOf = ({ days }: Structure): Paper[] =>
  days.flatMap((day) => day.sessions.flatMap((session) => session.papers));

export type PaperTexts = Readonly<Record<string, string>>;

export function structureFrom(loaded: Loaded): Structure {
  const structure = loaded.get(STRUCTURE_FILE) as Structure | undefined;
  if (!structure) throw new Error(`Could not load ${STRUCTURE_FILE}`);
  return structure;
}
