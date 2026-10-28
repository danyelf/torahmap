// Where every piece of the program stands: days side by side, a day's time slots down its column,
// a session's papers in lines as wide as a day, each paper's pieces in a block of at most
// MAX_PAPER_ROWS rows that grows wider instead of taller.

import type { MapItem } from '@torahmap/engine';
import { idHash, positionJitter } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { CoverBox } from './covers.ts';
import { timeSlotsOf, type Day, type Paper, type Section, type Structure } from './data.ts';

const SQUARE_SIZE = 6;
const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

const MIN_PAPER_COLUMNS = 4; // squares across a short paper
const SHORT_PAPERS_PER_DAY = 8; // across a day's width, which longer papers share
// Papers of up to 48 pieces keep four columns; a longer one gains columns rather than height.
const MAX_PAPER_ROWS = 12;
const PAPER_GAP = SQUARE_SIZE;
const LINE_GAP = 5 * SQUARE_SIZE; // between one line of papers and the next
const LABEL_ROOM = 6 * SQUARE_SIZE; // above each session, for a one-line name
const LABEL_LINE = 3 * SQUARE_SIZE; // each further line of a name that wraps
// Characters of a session's name that fit across a day at the label's size.
const LABEL_LINE_CHARS = 32;
const SLOT_GAP = 6 * SQUARE_SIZE; // between one time slot and the next
const TIME_ROOM = 10 * SQUARE_SIZE; // at the top of a slot, for its time, before its first session
export const PANEL_PAD = 8; // a slot's panel reaches this far past its squares, but not above its top
const DAY_GAP = 10 * SQUARE_SIZE; // holds two panels' padding and the day label that stands to the left
const DAY_WIDTH =
  SHORT_PAPERS_PER_DAY * MIN_PAPER_COLUMNS * SQUARE_SIZE + (SHORT_PAPERS_PER_DAY - 1) * PAPER_GAP;

const columnsOf = (paper: Paper): number =>
  Math.max(MIN_PAPER_COLUMNS, Math.ceil(paper.pieces.length / MAX_PAPER_ROWS));
const widthOf = (paper: Paper): number => columnsOf(paper) * SQUARE_SIZE;

/** A session's papers in lines that each fit across a day. */
function linesOf(papers: readonly Paper[]): Paper[][] {
  const lines: Paper[][] = [];
  let used = 0;
  for (const paper of papers) {
    if (!lines.length || used + PAPER_GAP + widthOf(paper) > DAY_WIDTH) {
      lines.push([]);
      used = -PAPER_GAP;
    }
    used += PAPER_GAP + widthOf(paper);
    lines[lines.length - 1].push(paper);
  }
  return lines;
}

export interface PieceItem extends MapItem {
  paper: Paper;
  session: string;
  day: string;
  /** Which piece of the paper this is, from 0. */
  piece: number;
  section: Section;
}

export interface Panel extends CoverBox {
  time: string;
}

export interface Layout {
  items: PieceItem[];
  books: BookBox[];
  /** Each time slot's panel, padded. */
  panels: Panel[];
  bounds: { width: number; height: number };
}

const nameLines = (name: string): number => Math.max(1, Math.ceil(name.length / LABEL_LINE_CHARS));

export const pieceId = (paper: number, piece: number): string => `${paper}.${piece}`;

export function computeLayout(structure: Structure): Layout {
  const items: PieceItem[] = [];
  const books: BookBox[] = [];
  const panels: Panel[] = [];
  let x = 0;
  let height = 0;
  const label = (name: string, day: Day, minY: number): BookBox => ({
    name,
    hebrewName: '',
    section: day.name,
    minX: x,
    maxX: x + DAY_WIDTH,
    minY,
  });

  for (const day of structure.days) {
    let y = 0;
    timeSlotsOf(day).forEach((slot, s) => {
      if (s > 0) y += SLOT_GAP;
      const top = y;
      // A book with no name: the day's name stands level with the top of its first slot.
      if (s === 0) books.push(label('', day, top + LABEL_ROOM));
      y += TIME_ROOM;
      for (const session of slot.sessions) {
        y += LABEL_ROOM + (nameLines(session.name) - 1) * LABEL_LINE;
        books.push(label(session.name, day, y));
        for (const line of linesOf(session.papers)) {
          let left = x;
          line.forEach((paper) => {
            const columns = columnsOf(paper);
            [...paper.pieces].forEach((letter, n) => {
              const id = pieceId(paper.index, n);
              items.push({
                id,
                x: left + (n % columns) * SQUARE_SIZE,
                y: y + Math.floor(n / columns) * SQUARE_SIZE,
                size: SQUARE_SIZE,
                jitter: positionJitter(idHash(id), POSITION_JITTER),
                paper,
                session: session.name,
                day: day.name,
                piece: n,
                section: letter as Section,
              });
            });
            left += widthOf(paper) + PAPER_GAP;
          });
          const rows = Math.max(
            ...line.map((paper) => Math.ceil(paper.pieces.length / columnsOf(paper))),
          );
          y += rows * SQUARE_SIZE + LINE_GAP;
        }
      }
      panels.push({
        minX: x - PANEL_PAD,
        maxX: x + DAY_WIDTH + PANEL_PAD,
        minY: top,
        maxY: y - LINE_GAP + PANEL_PAD,
        time: slot.start || 'No time',
      });
    });
    height = Math.max(height, y);
    x += DAY_WIDTH + DAY_GAP;
  }
  return { items, books, panels, bounds: { width: x - DAY_GAP, height } };
}
