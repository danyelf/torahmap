// Bookshelf layout for the Talmud map.
//
// - Each tractate is a block of amud-rows sharing a right edge, RTL within
//   each row.
// - Sedarim are stacked vertically (top to bottom in canonical order).
// - Within a shelf, tractates are arranged right-to-left (RTL reading).
// - Tractates on a shelf are top-aligned.
// - Final coordinates have minX >= 0 (shifted into the first quadrant for
//   compatibility with the existing camera/render pipeline).

import type { SpatialItem } from '@torahmap/engine';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import { positionJitter } from '@torahmap/utils';
import type { TalmudIdentity } from './types.ts';
import type { TalmudStructure, TalmudTractate } from './data.ts';
import { segmentHashId } from './segmentHash.ts';
import { bookFromUrl, bookToUrl } from '@torahmap/link';
import {
  SEGMENT_SIZE,
  PEREK_GAP,
  BOOK_GAP,
  SEDER_GAP,
  TRACTATE_LABEL_HEIGHT,
  TRACTATE_WRAP_ROWS,
  MIN_PEREK_STUB_ROWS,
  COLUMN_HEIGHT_TOLERANCE,
  TRACTATE_COLUMN_GAP,
  POSITION_JITTER,
  SEDARIM,
  DAF_LABEL_ROOM,
  BOOK_HEADROOM,
  BOOK_PADDING,
} from './constants.ts';

export type TalmudLayoutItem = SpatialItem<TalmudIdentity>;

/** A segment's id: Bava Kamma 2a:1 is "Bava.Kamma.2a.1". */
export function talmudId(s: TalmudIdentity): string {
  return `${bookToUrl(s.tractate)}.${amudName(s)}.${s.segment}`;
}

/** A daf as numbered, "2", or one side of it, "2a". */
export function amudName(s: { daf: number; amud?: string }): string {
  return `${s.daf}${s.amud ?? ''}`;
}

/** Read a segment's id: "Bava.Kamma.2a.1" is Bava Kamma 2a:1; null for anything else. */
export function parseTalmudId(id: string): TalmudIdentity | null {
  const match = /^(.+)\.(\d+)([ab])\.(\d+)$/.exec(id);
  if (!match) return null;
  const [, tractate, daf, amud, segment] = match;
  const parsed: TalmudIdentity = {
    tractate: bookFromUrl(tractate),
    daf: Number(daf),
    amud: amud as 'a' | 'b',
    segment: Number(segment),
  };
  // "2a" and "02a" are the same page, but only one is a square's id.
  return talmudId(parsed) === id ? parsed : null;
}

/** A segment as readers write it: "Bava Kamma 2a:1". */
export function talmudRef(s: TalmudIdentity): string {
  return `${dafRef(s)}:${s.segment}`;
}

/** A daf, or one side of it, as readers write it: "Bava Kamma 2" or "Bava Kamma 2a". */
export function dafRef(s: { tractate: string; daf: number; amud?: string }): string {
  return `${s.tractate} ${amudName(s)}`;
}

/** The box round a tractate's squares; its section is its seder. */
export interface TractateBlock extends BookBox {
  maxY: number;
  /**
   * The tinted box the tractate stands in, as tall as the tallest tractate's on its shelf. It holds
   * the tractate's name above its squares, BOOK_PADDING left of them and the room for its daf
   * numbers right of and below them.
   */
  cover: Box;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PerekAnchor {
  tractate: string;
  perekIdx: number;
  hebrewName: string;
  // The right edge and top of the perek's first row, in world coords.
  rightX: number;
  topY: number;
  /** The perek began in the column before: this anchor is its continuation. */
  continued: boolean;
}

/**
 * Where an amud's daf label goes: its column's right edge and its first row's top, in world
 * coordinates.
 */
export interface DafRowAnchor {
  tractate: string;
  daf: number;
  amud: 'a' | 'b';
  rightX: number;
  topY: number;
}

export interface TalmudLayoutResult {
  items: TalmudLayoutItem[];
  tractateBlocks: TractateBlock[];
  perekAnchors: PerekAnchor[];
  dafRows: DafRowAnchor[];
  bounds: { width: number; height: number };
}

interface AmudRow {
  daf: number;
  amud: 'a' | 'b';
  segments: Array<{ segment: number; isMishnah: boolean }>;
  perekIdx: number;
}

/**
 * Walk a tractate's amudim and produce rows. An amud with perekBoundaryAt
 * becomes two half-rows.
 */
function rowsForTractate(tractate: TalmudTractate): AmudRow[] {
  const rows: AmudRow[] = [];
  for (const amud of tractate.amudim) {
    // An amud with no text, such as Nazir 33b, has no row.
    if (amud.segmentCount === 0) continue;

    if (amud.perekBoundaryAt !== undefined && amud.perekBoundaryAt > 0) {
      const firstHalf: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx,
      };
      const secondHalf: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx + 1,
      };
      for (let s = 0; s < amud.segmentCount; s++) {
        const seg = {
          segment: s + 1,
          isMishnah: amud.mishnahMask[s] ?? false,
        };
        if (s < amud.perekBoundaryAt) {
          firstHalf.segments.push(seg);
        } else {
          secondHalf.segments.push(seg);
        }
      }
      if (firstHalf.segments.length > 0) rows.push(firstHalf);
      if (secondHalf.segments.length > 0) rows.push(secondHalf);
    } else {
      const row: AmudRow = {
        daf: amud.daf,
        amud: amud.amud,
        segments: [],
        perekIdx: amud.perekIdx,
      };
      for (let s = 0; s < amud.segmentCount; s++) {
        row.segments.push({
          segment: s + 1,
          isMishnah: amud.mishnahMask[s] ?? false,
        });
      }
      rows.push(row);
    }
  }
  return rows;
}

interface LocalPerekAnchor {
  perekIdx: number;
  // Local coordinates of the right edge / top of the perek's first row.
  // The right edge is the right edge of the column the perek starts in.
  rightX: number;
  topY: number;
  continued: boolean;
}

interface LaidOutTractate {
  name: string;
  hebrewName: string;
  seder: string;
  items: TalmudLayoutItem[];
  perekAnchors: LocalPerekAnchor[];
  dafRows: Omit<DafRowAnchor, 'tractate'>[];
  // Local coordinates: origin (0, 0) = top-right. x is <= 0; y is >= 0.
  width: number;
  height: number;
}

/**
 * Distribute amud-rows into columns when a tractate exceeds TRACTATE_WRAP_ROWS rows: as few
 * columns as fit, cut so the tallest is as short as it can be, then, among cuts within
 * COLUMN_HEIGHT_TOLERANCE of that, the fewest through the middle of a perek, then the most even.
 * A cut through a perek leaves at least MIN_PEREK_STUB_ROWS rows on each side.
 */
function splitRowsIntoColumns(rows: AmudRow[]): AmudRow[][] {
  if (rows.length <= TRACTATE_WRAP_ROWS) return [rows];
  const numCols = Math.ceil(rows.length / TRACTATE_WRAP_ROWS);
  const n = rows.length;

  // changes[i]: how many perek changes lie between rows 0..i
  const changes = [0];
  for (let i = 1; i < n; i++) {
    changes.push(changes[i - 1] + (rows[i].perekIdx !== rows[i - 1].perekIdx ? 1 : 0));
  }
  // Rows a..b-1 as one column: their squares, and the gap at each perek change inside.
  const height = (a: number, b: number) =>
    (b - a) * SEGMENT_SIZE + PEREK_GAP * (changes[b - 1] - changes[a]);
  const startsPerek = (i: number) =>
    i === 0 || i === n || rows[i].perekIdx !== rows[i - 1].perekIdx;
  // The rows of the perek a cut at i falls in, either side of the cut.
  const before = (i: number) => {
    let k = i;
    while (k > 0 && rows[k - 1].perekIdx === rows[i].perekIdx) k--;
    return i - k;
  };
  const after = (i: number) => {
    let k = i;
    while (k < n && rows[k].perekIdx === rows[i - 1].perekIdx) k++;
    return k - i;
  };
  const canCut = Array.from(
    { length: n + 1 },
    (_, i) =>
      startsPerek(i) || (before(i) >= MIN_PEREK_STUB_ROWS && after(i) >= MIN_PEREK_STUB_ROWS),
  );

  interface Cell {
    midPerekCuts: number;
    sumOfSquares: number;
    prev: number;
  }
  /** The best cuts into numCols columns none taller than `cap`, or null if there are none. */
  const solve = (cap: number, preferWholePerakim: boolean) => {
    const best: (Cell | null)[][] = Array.from({ length: numCols + 1 }, () =>
      Array<Cell | null>(n + 1).fill(null),
    );
    best[0][0] = { midPerekCuts: 0, sumOfSquares: 0, prev: -1 };
    for (let k = 1; k <= numCols; k++) {
      for (let j = k; j <= n; j++) {
        if (!canCut[j]) continue;
        const midPerek = preferWholePerakim && !startsPerek(j) ? 1 : 0;
        for (let i = k - 1; i < j; i++) {
          const from = best[k - 1][i];
          if (!from) continue;
          const h = height(i, j);
          if (h > cap) continue;
          const cell = {
            midPerekCuts: from.midPerekCuts + midPerek,
            sumOfSquares: from.sumOfSquares + h * h,
            prev: i,
          };
          const old = best[k][j];
          if (
            !old ||
            cell.midPerekCuts < old.midPerekCuts ||
            (cell.midPerekCuts === old.midPerekCuts && cell.sumOfSquares < old.sumOfSquares)
          ) {
            best[k][j] = cell;
          }
        }
      }
    }
    return best[numCols][n] ? best : null;
  };

  let lo = 0;
  let hi = height(0, n);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (solve(mid, false)) hi = mid;
    else lo = mid + 1;
  }
  // Every 9 rows hold a place to cut, a perek start or a place deep enough in a long perek, so
  // there are cuts for a column every TRACTATE_WRAP_ROWS rows.
  const best = solve(lo + COLUMN_HEIGHT_TOLERANCE, true);
  if (!best) throw new Error(`no way to cut ${n} rows into ${numCols} columns`);
  const columns: AmudRow[][] = [];
  let end = n;
  for (let k = numCols; k >= 1; k--) {
    const start = best[k][end]!.prev;
    columns.unshift(rows.slice(start, end));
    end = start;
  }
  return columns;
}

/**
 * Lay out one tractate in local coordinates (top-right at 0,0).
 *
 * Each row grows leftward (RTL); rows stack top-to-bottom within a column;
 * perakim are separated by PEREK_GAP. Tall tractates are split into
 * multiple columns side-by-side (column 0 is rightmost / read first).
 */
function layoutTractate(tractate: TalmudTractate): LaidOutTractate {
  const allRows = rowsForTractate(tractate);
  const columns = splitRowsIntoColumns(allRows);
  const items: TalmudLayoutItem[] = [];
  const perekAnchors: LocalPerekAnchor[] = [];
  const dafRows: Omit<DafRowAnchor, 'tractate'>[] = [];
  const amudimSeen = new Set<string>();

  // Pass 1: lay out each column in its own local frame (right edge at x=0).
  // While iterating, capture a perek anchor at the y of each perek's first
  // row. We record local-to-the-column coords; pass 2 will translate to
  // tractate coords using the column's right-edge offset.
  const columnFrames: {
    items: TalmudLayoutItem[];
    width: number;
    height: number;
    localPereks: LocalPerekAnchor[]; // anchors in column-local coords (rightX always 0)
    localDafs: Omit<DafRowAnchor, 'tractate'>[];
  }[] = [];
  let previousColumnLastPerek = -1;
  for (const colRows of columns) {
    const colItems: TalmudLayoutItem[] = [];
    const colPereks: LocalPerekAnchor[] = [];
    const colDafs: Omit<DafRowAnchor, 'tractate'>[] = [];
    let y = 0;
    let lastPerekIdx = -1;
    let colMaxWidth = 0;
    const continuedFrom = previousColumnLastPerek;
    for (const row of colRows) {
      if (lastPerekIdx !== -1 && row.perekIdx !== lastPerekIdx) {
        y += PEREK_GAP;
      }
      // Record an anchor when we cross into a new perek (and at the very
      // first row of the column for whatever perek it belongs to — wrap
      // splits can put the same perek across two columns and we want a
      // continuation label at the top of the second column too).
      if (row.perekIdx !== lastPerekIdx) {
        colPereks.push({
          perekIdx: row.perekIdx,
          rightX: 0,
          topY: y,
          continued: lastPerekIdx === -1 && row.perekIdx === continuedFrom,
        });
      }
      const amud = amudName(row);
      if (!amudimSeen.has(amud)) {
        amudimSeen.add(amud);
        colDafs.push({ daf: row.daf, amud: row.amud, rightX: 0, topY: y });
      }
      lastPerekIdx = row.perekIdx;

      const rowWidth = row.segments.length * SEGMENT_SIZE;
      if (rowWidth > colMaxWidth) colMaxWidth = rowWidth;

      for (let i = 0; i < row.segments.length; i++) {
        const seg = row.segments[i];
        const baseX = -(i + 1) * SEGMENT_SIZE;
        const segment = {
          tractate: tractate.name,
          daf: row.daf,
          amud: row.amud,
          segment: seg.segment,
        };
        const seed = segmentHashId(segment);
        colItems.push({
          ...segment,
          id: talmudId(segment),
          x: baseX,
          y,
          size: SEGMENT_SIZE,
          round: seg.isMishnah,
          jitter: positionJitter(seed, POSITION_JITTER),
        });
      }
      y += SEGMENT_SIZE;
    }
    previousColumnLastPerek = lastPerekIdx;
    columnFrames.push({
      items: colItems,
      width: colMaxWidth,
      height: y,
      localPereks: colPereks,
      localDafs: colDafs,
    });
  }

  // Pass 2: position columns side-by-side. Column 0 is rightmost (RTL).
  // Each column's local right edge sits at columnRightEdge; its segments
  // shift to columnRightEdge + local_x.
  let columnRightEdge = 0;
  let totalWidth = 0;
  let maxHeight = 0;
  for (let c = 0; c < columnFrames.length; c++) {
    const frame = columnFrames[c];
    for (const it of frame.items) {
      items.push({
        ...it,
        x: columnRightEdge + it.x,
        y: it.y,
      });
    }
    for (const lp of frame.localPereks) {
      perekAnchors.push({
        perekIdx: lp.perekIdx,
        rightX: columnRightEdge, // column right edge in tractate-local coords
        topY: lp.topY,
        continued: lp.continued,
      });
    }
    for (const d of frame.localDafs) dafRows.push({ ...d, rightX: columnRightEdge });
    if (frame.height > maxHeight) maxHeight = frame.height;
    if (c === columnFrames.length - 1) {
      totalWidth = -(columnRightEdge - frame.width);
    }
    columnRightEdge -= frame.width + TRACTATE_COLUMN_GAP;
  }
  // For the single-column case the loop sets totalWidth correctly via the
  // last iteration; double-check in case columns is empty.
  if (columnFrames.length === 0) {
    totalWidth = 0;
    maxHeight = 0;
  }

  return {
    name: tractate.name,
    hebrewName: tractate.hebrewName,
    seder: tractate.seder,
    items,
    perekAnchors,
    dafRows,
    width: totalWidth,
    height: maxHeight,
  };
}

export function computeTalmudLayout(structure: TalmudStructure): TalmudLayoutResult {
  // 1. Lay out each tractate in local coordinates.
  const laid = structure.tractates.map(layoutTractate);

  // 2. Group by seder, in shelf order, with any unknown seder after the rest.
  const bySeder = new Map<string, LaidOutTractate[]>(SEDARIM.map((s) => [s.en, []]));
  for (const t of laid) {
    if (!bySeder.has(t.seder)) bySeder.set(t.seder, []);
    bySeder.get(t.seder)!.push(t);
  }

  // 3. Arrange shelves top-to-bottom.
  //    Within a shelf: tractates arranged right-to-left, top-aligned.
  //    First tractate on each shelf has its right edge at x = 0.
  //    Subsequent tractates' right edges step leftward into negative x.
  //    (Everything gets shifted to positive x in step 4.)

  const allItems: TalmudLayoutItem[] = [];
  const tractateBlocks: TractateBlock[] = [];
  const allPerekAnchors: PerekAnchor[] = [];
  const allDafRows: DafRowAnchor[] = [];

  // Quick lookup for perek hebrew names per tractate.
  const perekNamesByTractate = new Map<string, string[]>();
  for (const t of structure.tractates) {
    perekNamesByTractate.set(
      t.name,
      t.perakim.map((p) => p.hebrewName),
    );
  }

  let shelfY = BOOK_HEADROOM;
  for (const tractates of bySeder.values()) {
    if (tractates.length === 0) continue;
    const shelfHeight = TRACTATE_LABEL_HEIGHT + Math.max(...tractates.map((t) => t.height));

    let shelfRightEdge = 0;

    for (const t of tractates) {
      const tractateRightEdge = shelfRightEdge;
      const tractateLeftEdge = tractateRightEdge - t.width;
      const tractateTop = shelfY + TRACTATE_LABEL_HEIGHT;
      const tractateBottom = tractateTop + t.height;
      const cover = {
        minX: tractateLeftEdge - BOOK_PADDING,
        minY: shelfY - BOOK_HEADROOM,
        maxX: tractateRightEdge + DAF_LABEL_ROOM.right,
        maxY: shelfY + shelfHeight + DAF_LABEL_ROOM.below,
      };

      // Shift this tractate's items into world coordinates:
      //   local x (<= 0) → tractateRightEdge + local_x
      //   local y (>= 0) → tractateTop + local_y
      for (const item of t.items) {
        allItems.push({
          ...item,
          x: tractateRightEdge + item.x,
          y: tractateTop + item.y,
        });
      }

      tractateBlocks.push({
        name: t.name,
        hebrewName: t.hebrewName,
        section: t.seder,
        minX: tractateLeftEdge,
        minY: tractateTop,
        maxX: tractateRightEdge,
        maxY: tractateBottom,
        cover,
      });

      // Translate the tractate's local perek anchors into world coords.
      const perekNames = perekNamesByTractate.get(t.name) ?? [];
      for (const lp of t.perekAnchors) {
        const hebrew = perekNames[lp.perekIdx] ?? `פרק ${lp.perekIdx + 1}`;
        allPerekAnchors.push({
          tractate: t.name,
          perekIdx: lp.perekIdx,
          hebrewName: hebrew,
          rightX: tractateRightEdge + lp.rightX,
          topY: tractateTop + lp.topY,
          continued: lp.continued,
        });
      }

      for (const d of t.dafRows) {
        allDafRows.push({
          ...d,
          tractate: t.name,
          rightX: tractateRightEdge + d.rightX,
          topY: tractateTop + d.topY,
        });
      }

      shelfRightEdge = cover.minX - BOOK_GAP - DAF_LABEL_ROOM.right;
    }

    shelfY += shelfHeight + SEDER_GAP;
  }

  // 4. Shift everything so minX >= 0. The covers hold every square.
  let globalMinX = 0;
  for (const { cover } of tractateBlocks) {
    if (cover.minX < globalMinX) globalMinX = cover.minX;
  }
  const dx = -globalMinX;
  for (const item of allItems) {
    item.x += dx;
  }
  for (const block of tractateBlocks) {
    block.minX += dx;
    block.maxX += dx;
    block.cover.minX += dx;
    block.cover.maxX += dx;
  }
  for (const a of allPerekAnchors) {
    a.rightX += dx;
  }
  for (const d of allDafRows) {
    d.rightX += dx;
  }

  // 5. Compute bounds
  let maxX = 0;
  let maxY = 0;
  for (const { cover } of tractateBlocks) {
    if (cover.maxX > maxX) maxX = cover.maxX;
    if (cover.maxY > maxY) maxY = cover.maxY;
  }

  return {
    items: allItems,
    tractateBlocks,
    perekAnchors: allPerekAnchors,
    dafRows: allDafRows,
    bounds: { width: maxX, height: maxY },
  };
}
