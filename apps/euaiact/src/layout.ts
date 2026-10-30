// Where every square of the Act stands: recitals over articles over annexes.

import type { MapItem } from '@torahmap/engine';
import { idHash, positionJitter } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { ActBlock, ActCell, ActGroup, ActStructure, Origin } from './data.ts';
import type { Layer } from './ids.ts';
import {
  ARTICLE_GAP,
  CHAPTER_GAP,
  COLUMN_WIDTH,
  LABEL_ROOM,
  LAYER_GAP,
  RECITALS_PER_LINE,
  SECTION_GAP,
  SPLIT_GAP,
  POSITION_JITTER,
  SQUARE_SIZE as S,
} from './constants.ts';

const jitterFor = (id: string) => positionJitter(idHash(id), POSITION_JITTER);

export interface ActItem extends MapItem {
  layer: Layer;
  origin: Origin;
  /** A list's lead-in sentence, drawn darker than the points beneath it. */
  lead: boolean;
  /** The chapter an article is in; empty for recitals and annexes. */
  chapter: string;
}

/** Where an article's number goes: its column's left edge, above its first row and that row's jitter. */
interface ArticleAnchor {
  number: string;
  x: number;
  y: number;
}

export interface ActLayout {
  items: ActItem[];
  books: BookBox[];
  articles: ArticleAnchor[];
  bounds: { width: number; height: number };
}

interface Placed {
  cell: ActCell;
  lead: boolean;
  col: number;
  row: number;
}

/**
 * A block's squares by column and row, and how many rows it takes. Plain paragraphs flow along a
 * line; a list starts a new line with its lead-in, its points wrapped beneath it, indented.
 */
function placeGroups(groups: readonly ActGroup[]): { placed: Placed[]; rows: number } {
  const placed: Placed[] = [];
  let row = 0;
  let col = 0;
  for (const group of groups) {
    if (group.kind === 'plain') {
      if (col >= COLUMN_WIDTH) {
        row++;
        col = 0;
      }
      placed.push({ cell: group.cell, lead: false, col, row });
      col++;
      continue;
    }
    if (col) {
      row++;
      col = 0;
    }
    if (group.lead) {
      placed.push({ cell: group.lead, lead: true, col: 0, row });
      row++;
    }
    const across = COLUMN_WIDTH - 1;
    group.points.forEach((cell, i) =>
      placed.push({ cell, lead: false, col: 1 + (i % across), row: row + Math.floor(i / across) }),
    );
    if (group.points.length) row += Math.floor((group.points.length - 1) / across) + 1;
  }
  return { placed, rows: row + (col ? 1 : 0) };
}

export function computeActLayout(structure: ActStructure): ActLayout {
  const items: ActItem[] = [];
  const books: BookBox[] = [];
  const articles: ArticleAnchor[] = [];

  /** Stands a column of blocks at (x, top) and returns the y below it. */
  const column = (
    runs: readonly (readonly ActBlock[])[],
    x: number,
    top: number,
    layer: Layer,
    chapter: string,
  ): number => {
    let y = top;
    runs.forEach((run, i) => {
      if (i) y += SECTION_GAP;
      for (const block of run) {
        if (layer === 'article') articles.push({ number: block.number, x, y: y - POSITION_JITTER });
        const { placed, rows } = placeGroups(block.groups);
        for (const p of placed) {
          items.push({
            id: p.cell.id,
            x: x + p.col * S,
            y: y + p.row * S,
            size: S,
            jitter: jitterFor(p.cell.id),
            layer,
            origin: p.cell.origin,
            lead: p.lead,
            chapter,
          });
        }
        y += rows * S + ARTICLE_GAP;
      }
    });
    return y;
  };

  // Recitals: a paragraph apiece, so twice as wide as a square.
  const recitalsTop = LABEL_ROOM;
  const lines = Math.ceil(structure.recitals / RECITALS_PER_LINE);
  for (let i = 0; i < structure.recitals; i++) {
    items.push({
      id: `Recital.${i + 1}`,
      x: (i % RECITALS_PER_LINE) * 2 * S,
      y: recitalsTop + Math.floor(i / RECITALS_PER_LINE) * S,
      size: S,
      width: 2 * S,
      jitter: jitterFor(`Recital.${i + 1}`),
      layer: 'recital',
      origin: 'B',
      lead: false,
      chapter: '',
    });
  }
  books.push({
    name: 'Recitals',
    hebrewName: '',
    section: 'Recitals',
    minX: 0,
    maxX: Math.min(structure.recitals, RECITALS_PER_LINE) * 2 * S,
    minY: recitalsTop,
  });

  // Articles: a column per chapter, or per section where a chapter is split.
  const articlesTop = recitalsTop + lines * S + LAYER_GAP + LABEL_ROOM;
  let x = 0;
  let articlesBottom = articlesTop;
  for (const chapter of structure.chapters) {
    const minX = x;
    chapter.columns.forEach((col, i) => {
      articlesBottom = Math.max(
        articlesBottom,
        column(col.runs, x, articlesTop, 'article', chapter.number),
      );
      const last = i === chapter.columns.length - 1;
      x += COLUMN_WIDTH * S + (last ? CHAPTER_GAP : SPLIT_GAP);
    });
    books.push({
      name: `Ch. ${chapter.number}`,
      hebrewName: '',
      section: 'Articles',
      minX,
      maxX: x - CHAPTER_GAP,
      minY: articlesTop,
    });
  }
  const articlesRight = x - CHAPTER_GAP;

  // Annexes: a column each, their parts one under the next.
  const annexesTop = articlesBottom + LAYER_GAP + LABEL_ROOM;
  x = 0;
  let annexesBottom = annexesTop;
  for (const annex of structure.annexes) {
    annexesBottom = Math.max(annexesBottom, column([annex.blocks], x, annexesTop, 'annex', ''));
    books.push({
      name: `Annex ${annex.number}`,
      hebrewName: '',
      section: 'Annexes',
      minX: x,
      maxX: x + COLUMN_WIDTH * S,
      minY: annexesTop,
    });
    x += COLUMN_WIDTH * S + CHAPTER_GAP;
  }

  const width = Math.max(articlesRight, x - CHAPTER_GAP, books[0].maxX);
  return { items, books, articles, bounds: { width, height: annexesBottom } };
}
