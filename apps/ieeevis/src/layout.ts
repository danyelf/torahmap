// Where every piece of the program stands: days side by side, a day's time slots down its column,
// a session's papers in lines as wide as a day, each paper's pieces in rows of one width, so its
// height alone shows its length.

import type { MapItem } from '@torahmap/engine';
import { idHash, positionJitter } from '@torahmap/utils';
import { sectionLabelReach, type BookBox } from '@torahmap/shell/mapLabels.ts';
import type { CoverBox } from './covers.ts';
import { timeSlotsOf, type Day, type Paper, type Section, type Structure } from './data.ts';

const SQUARE_SIZE = 6;
const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

const PAPER_COLUMNS = 6; // squares across every paper
const PAPERS_PER_DAY = 8; // across a day's width
const PAPER_GAP = SQUARE_SIZE;
const LINE_GAP = 2 * SQUARE_SIZE; // between one line of papers and the next
const LABEL_ROOM = 4 * SQUARE_SIZE; // above each session, for a one-line name
const LABEL_LINE = 3 * SQUARE_SIZE; // each further line of a name that wraps
const SLOT_GAP = 3 * SQUARE_SIZE; // between one time slot and the next
export const PANEL_PAD = 8; // a slot's panel reaches this far past its squares, but not above its top
// A slot's first name keeps about 7 units of its line above its capitals, which then stand as far
// below the panel's top as the squares stand in from its left.
const FIRST_NAME_PAD = PANEL_PAD - 7;
// Left of a slot's panel, for its time.
export const TIME_STRIP = 7 * SQUARE_SIZE;
const DAY_GAP = 2 * PANEL_PAD + TIME_STRIP;
const UNDER_GAP = 3 * SQUARE_SIZE; // above the name of a day that stands under another
const DAY_WIDTH = PAPERS_PER_DAY * PAPER_COLUMNS * SQUARE_SIZE + (PAPERS_PER_DAY - 1) * PAPER_GAP;
// Characters of a session's name that fit across a day: one is about 7.3 units wide at the label's size.
const LABEL_LINE_CHARS = Math.floor(DAY_WIDTH / 7.3);

const rowsOf = (paper: Paper): number => Math.ceil(paper.pieces.length / PAPER_COLUMNS);
const PAPER_WIDTH = PAPER_COLUMNS * SQUARE_SIZE;

/** A session's papers in lines that each fit across a day. */
const linesOf = (papers: readonly Paper[]): Paper[][] =>
  Array.from({ length: Math.ceil(papers.length / PAPERS_PER_DAY) }, (_, i) =>
    papers.slice(i * PAPERS_PER_DAY, (i + 1) * PAPERS_PER_DAY),
  );

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

export const DAY_LABEL_SIZE = { fontSize: 14, gapEm: 0.5 };

// The map's title stands this tall above the days' names, this far clear of them.
export const TITLE_HEIGHT = 12 * SQUARE_SIZE;
const TITLE_GAP = 4 * SQUARE_SIZE;
export const TITLE_CORNER = {
  x: -PANEL_PAD,
  y: -sectionLabelReach(DAY_LABEL_SIZE) - TITLE_GAP - TITLE_HEIGHT,
};

// The credit's two lines, under the last panel drawn: the papers not yet scheduled.
export const CREDIT_SIZE = { fontSize: 9, lineEm: 1.3 };
const CREDIT_GAP = 2 * SQUARE_SIZE;

export function creditCorner({ panels }: Layout) {
  const last = panels[panels.length - 1];
  return { x: last.minX + PANEL_PAD, y: last.maxY + CREDIT_GAP };
}

/** The whole program with its title, day labels, time strip, panels' padding and credit: the box the map opens fitted to. */
export function programBox(laid: Layout) {
  return {
    minX: -PANEL_PAD - TIME_STRIP,
    minY: TITLE_CORNER.y,
    maxX: laid.bounds.width + PANEL_PAD,
    maxY: Math.max(
      laid.bounds.height + PANEL_PAD,
      creditCorner(laid).y + 2 * CREDIT_SIZE.fontSize * CREDIT_SIZE.lineEm,
    ),
  };
}

export const pieceId = (paper: number, piece: number): string => `${paper}.${piece}`;

/** The number of the paper a piece belongs to. */
export const paperOf = (id: string): string => id.slice(0, id.indexOf('.'));

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
    const slots = timeSlotsOf(day);
    // A day with no times, as for the papers not yet scheduled, stands under the day before.
    const stacked = x > 0 && slots.every((slot) => !slot.start);
    if (stacked) x -= DAY_WIDTH + DAY_GAP;
    let y = stacked
      ? panels[panels.length - 1].maxY + UNDER_GAP + sectionLabelReach(DAY_LABEL_SIZE)
      : 0;
    slots.forEach((slot, s) => {
      if (s > 0) y += SLOT_GAP;
      const top = y;
      // A book with no name: the day's name stands above the top of its first slot.
      if (s === 0) books.push(label('', day, top));
      y += FIRST_NAME_PAD;
      for (const session of slot.sessions) {
        y += LABEL_ROOM + (nameLines(session.name) - 1) * LABEL_LINE;
        books.push(label(session.name, day, y));
        for (const line of linesOf(session.papers)) {
          let left = x;
          line.forEach((paper) => {
            [...paper.pieces].forEach((letter, n) => {
              const id = pieceId(paper.index, n);
              items.push({
                id,
                x: left + (n % PAPER_COLUMNS) * SQUARE_SIZE,
                y: y + Math.floor(n / PAPER_COLUMNS) * SQUARE_SIZE,
                size: SQUARE_SIZE,
                jitter: positionJitter(idHash(id), POSITION_JITTER),
                paper,
                session: session.name,
                day: day.name,
                piece: n,
                section: letter as Section,
              });
            });
            left += PAPER_WIDTH + PAPER_GAP;
          });
          y += Math.max(...line.map(rowsOf)) * SQUARE_SIZE + LINE_GAP;
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
