// Where every piece of the program stands: days side by side, a day's sessions down its column,
// a session's papers in rows of PAPERS_PER_LINE, each paper's pieces in a narrow block.

import type { MapItem } from '@torahmap/engine';
import { positionJitter } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { Paper, Section, Structure } from './data.ts';

export const SQUARE_SIZE = 6;
export const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

const PAPER_COLUMNS = 4; // squares across a paper
const PAPERS_PER_LINE = 8;
const PAPER_GAP = SQUARE_SIZE;
const LINE_GAP = 2 * SQUARE_SIZE;
const LABEL_ROOM = 6 * SQUARE_SIZE; // above each session, for its name
const DAY_GAP = 10 * SQUARE_SIZE; // includes the day label that stands to the right
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
  bounds: { width: number; height: number };
}

/** A number from a square's id, the seed for its jitter. */
export function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

export const pieceId = (paper: number, piece: number): string => `${paper}.${piece}`;

type Fill = 'rows' | 'columns' | 'sections';

/** How a paper's pieces fill its block, from ?fill= in the address. */
function fillFromAddress(): Fill {
  const asked =
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('fill');
  return asked === 'columns' || asked === 'sections' ? asked : 'rows';
}

interface Slot {
  column: number;
  row: number;
}

/** The (column, row) of every piece of a paper, and how many rows the block takes. */
function slotsOf(pieces: string, fill: Fill): { slots: Slot[]; rows: number } {
  const n = pieces.length;
  const rows = Math.ceil(n / PAPER_COLUMNS);
  if (fill === 'columns') {
    return {
      slots: Array.from({ length: n }, (_, i) => ({ column: Math.floor(i / rows), row: i % rows })),
      rows,
    };
  }
  if (fill === 'sections') {
    const slots: Slot[] = [];
    let column = 0;
    let row = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0 && (pieces[i] !== pieces[i - 1] || column === PAPER_COLUMNS)) {
        column = 0;
        row++;
      }
      slots.push({ column: column++, row });
    }
    return { slots, rows: row + 1 };
  }
  return {
    slots: Array.from({ length: n }, (_, i) => ({
      column: i % PAPER_COLUMNS,
      row: Math.floor(i / PAPER_COLUMNS),
    })),
    rows,
  };
}

export function computeLayout(structure: Structure): Layout {
  const items: PieceItem[] = [];
  const books: BookBox[] = [];
  let x = 0;
  let height = 0;
  const fill = fillFromAddress();

  for (const day of structure.days) {
    let y = 0;
    for (const session of day.sessions) {
      y += LABEL_ROOM;
      books.push({
        name: session.name,
        hebrewName: '',
        section: day.name,
        minX: x,
        maxX: x + DAY_WIDTH,
        minY: y,
      });
      for (let start = 0; start < session.papers.length; start += PAPERS_PER_LINE) {
        const line = session.papers.slice(start, start + PAPERS_PER_LINE);
        const blocks = line.map((paper) => slotsOf(paper.pieces, fill));
        line.forEach((paper, k) => {
          const { slots } = blocks[k];
          const left = x + k * (PAPER_COLUMNS * SQUARE_SIZE + PAPER_GAP);
          [...paper.pieces].forEach((letter, n) => {
            const id = pieceId(paper.index, n);
            items.push({
              id,
              x: left + slots[n].column * SQUARE_SIZE,
              y: y + slots[n].row * SQUARE_SIZE,
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
        y += Math.max(...blocks.map((b) => b.rows)) * SQUARE_SIZE + LINE_GAP;
      }
    }
    height = Math.max(height, y);
    x += DAY_WIDTH + DAY_GAP;
  }
  return { items, books, bounds: { width: x - DAY_GAP, height } };
}
