// Where every piece of the program stands: days side by side, a day's time slots down its column,
// a session's papers in rows of PAPERS_PER_LINE, each paper's pieces in a narrow block.

import type { MapItem } from '@torahmap/engine';
import { idHash, positionJitter } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { CoverBox } from './covers.ts';
import { timeSlotsOf, type Day, type Paper, type Section, type Structure } from './data.ts';

const SQUARE_SIZE = 6;
const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

const PAPER_COLUMNS = 4; // squares across a paper
const PAPERS_PER_LINE = 8;
const PAPER_GAP = SQUARE_SIZE;
const LINE_GAP = 2 * SQUARE_SIZE;
const LABEL_ROOM = 6 * SQUARE_SIZE; // above each session, for its name
const SLOT_GAP = 6 * SQUARE_SIZE; // between one time slot and the next
const SLOT_ROOM = 2 * SQUARE_SIZE; // under a slot's time, before its first session
export const PANEL_PAD = 8; // a slot's panel reaches this far past its squares, but not above its top
const DAY_GAP = 10 * SQUARE_SIZE; // holds two panels' padding and the day label that stands to the left
const DAY_WIDTH = PAPERS_PER_LINE * PAPER_COLUMNS * SQUARE_SIZE + (PAPERS_PER_LINE - 1) * PAPER_GAP;

export interface PieceItem extends MapItem {
  paper: Paper;
  session: string;
  day: string;
  /** Which piece of the paper this is, from 0. */
  piece: number;
  section: Section;
}

export interface Layout {
  items: PieceItem[];
  books: BookBox[];
  /** Each time slot's panel, padded. */
  panels: CoverBox[];
  bounds: { width: number; height: number };
}

export const pieceId = (paper: number, piece: number): string => `${paper}.${piece}`;

/** Each piece's (column, row) in its paper's block: a section starts a row, and wraps when longer. */
export function slotsOf(pieces: string): { column: number; row: number }[] {
  let column = 0;
  let row = 0;
  return [...pieces].map((letter, n) => {
    if (n > 0 && (letter !== pieces[n - 1] || column === PAPER_COLUMNS)) {
      column = 0;
      row++;
    }
    return { column: column++, row };
  });
}

export function computeLayout(structure: Structure): Layout {
  const items: PieceItem[] = [];
  const books: BookBox[] = [];
  const panels: CoverBox[] = [];
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
      y += LABEL_ROOM;
      books.push(label(slot.start || 'No time given', day, y));
      y += SLOT_ROOM;
      for (const session of slot.sessions) {
        y += LABEL_ROOM;
        books.push(label(session.name, day, y));
        for (let start = 0; start < session.papers.length; start += PAPERS_PER_LINE) {
          const line = session.papers.slice(start, start + PAPERS_PER_LINE);
          const slots = line.map((paper) => slotsOf(paper.pieces));
          line.forEach((paper, k) => {
            const left = x + k * (PAPER_COLUMNS * SQUARE_SIZE + PAPER_GAP);
            [...paper.pieces].forEach((letter, n) => {
              const id = pieceId(paper.index, n);
              items.push({
                id,
                x: left + slots[k][n].column * SQUARE_SIZE,
                y: y + slots[k][n].row * SQUARE_SIZE,
                size: SQUARE_SIZE,
                jitter: positionJitter(idHash(id), POSITION_JITTER),
                paper,
                session: session.name,
                day: day.name,
                piece: n,
                section: letter as Section,
              });
            });
          });
          const rows = Math.max(...slots.map((paper) => (paper[paper.length - 1]?.row ?? -1) + 1));
          y += rows * SQUARE_SIZE + LINE_GAP;
        }
      }
      panels.push({
        minX: x - PANEL_PAD,
        maxX: x + DAY_WIDTH + PANEL_PAD,
        minY: top,
        maxY: y - LINE_GAP + PANEL_PAD,
      });
    });
    height = Math.max(height, y);
    x += DAY_WIDTH + DAY_GAP;
  }
  return { items, books, panels, bounds: { width: x - DAY_GAP, height } };
}
