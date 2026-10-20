// Bookshelf layout for the Talmud map.
//
// - Each tractate is a block of amud-rows sharing a right edge, RTL within
//   each row.
// - Sedarim are stacked vertically (top to bottom in canonical order).
// - Within a shelf, tractates are arranged right-to-left (RTL reading).
// - Tractates on a shelf are top-aligned.
// - Final coordinates have minX >= 0 (shifted into the first quadrant for
//   compatibility with the existing camera/render pipeline).

import { SQUARE_GAP, type SpatialItem } from '@torahmap/engine';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import { seededRandom } from '@torahmap/utils';
import type { TalmudIdentity } from './types.ts';
import { isHadran, type TalmudStructure, type TalmudTractate } from './data.ts';
import { segmentHashId } from './segmentHash.ts';
import { bookFromUrl, bookToUrl } from '@torahmap/link';
import {
  SEGMENT_SIZE,
  PEREK_GAP,
  BOOK_GAP,
  SEDER_GAP,
  TRACTATE_LABEL_HEIGHT,
  TRACTATE_WRAP_ROWS,
  TRACTATE_COLUMN_GAP,
  POSITION_JITTER,
  SEDARIM,
  DAF_LABEL_ROOM,
  BOOK_PADDING,
} from './constants.ts';

export type TalmudLayoutItem = SpatialItem<TalmudIdentity>;

/** A segment's id: Bava Kamma 2a:1 is "Bava.Kamma.2a.1". */
export function talmudId(s: TalmudIdentity): string {
  return `${bookToUrl(s.tractate)}.${s.daf}${s.amud}.${s.segment}`;
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
  return `${s.tractate} ${s.daf}${s.amud}:${s.segment}`;
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

/** A hadran line's square, and where its label goes: the square's left edge, half way down. */
export interface HadranAnchor {
  id: string;
  x: number;
  y: number;
}

export interface TalmudLayoutResult {
  items: TalmudLayoutItem[];
  tractateBlocks: TractateBlock[];
  perekAnchors: PerekAnchor[];
  dafRows: DafRowAnchor[];
  hadrans: HadranAnchor[];
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
 * Distribute amud-rows into balanced columns when a tractate exceeds
 * TRACTATE_WRAP_ROWS rows. Returns one or more arrays of rows; each
 * sub-array becomes a vertical column inside the tractate block.
 *
 * Goals:
 * - Don't wrap short tractates at all (single column).
 * - For tall tractates, balance row count across columns so columns are
 *   close to equal height (rather than first column always full).
 * - Try to break between perakim when possible — if a candidate split
 *   point falls inside a perek, nudge it to the nearest perek boundary
 *   within ±TRACTATE_WRAP_SLACK rows.
 */
const TRACTATE_WRAP_SLACK = 6;

function splitRowsIntoColumns(rows: AmudRow[]): AmudRow[][] {
  if (rows.length <= TRACTATE_WRAP_ROWS) return [rows];
  const numCols = Math.ceil(rows.length / TRACTATE_WRAP_ROWS);
  const target = Math.ceil(rows.length / numCols);

  const columns: AmudRow[][] = [];
  let cursor = 0;
  for (let c = 0; c < numCols; c++) {
    if (c === numCols - 1) {
      columns.push(rows.slice(cursor));
      break;
    }
    let split = cursor + target;
    // Snap to nearest perek boundary within slack window.
    const lo = Math.max(cursor + 1, split - TRACTATE_WRAP_SLACK);
    const hi = Math.min(rows.length - 1, split + TRACTATE_WRAP_SLACK);
    let best = split;
    let bestDist = Infinity;
    for (let i = lo; i <= hi; i++) {
      if (rows[i].perekIdx !== rows[i - 1].perekIdx) {
        const dist = Math.abs(i - split);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
    }
    split = best;
    columns.push(rows.slice(cursor, split));
    cursor = split;
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
  for (const colRows of columns) {
    const colItems: TalmudLayoutItem[] = [];
    const colPereks: LocalPerekAnchor[] = [];
    const colDafs: Omit<DafRowAnchor, 'tractate'>[] = [];
    let y = 0;
    let lastPerekIdx = -1;
    let colMaxWidth = 0;
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
        });
      }
      const amud = `${row.daf}${row.amud}`;
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
          jitter: {
            x: (seededRandom(seed * 2) - 0.5) * 2 * POSITION_JITTER,
            y: (seededRandom(seed * 2 + 1) - 0.5) * 2 * POSITION_JITTER,
          },
        });
      }
      y += SEGMENT_SIZE;
    }
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

  let shelfY = 0;
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
        minY: shelfY,
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

  const hadrans = allItems
    .filter((s) => isHadran(structure, s.tractate, s.daf, s.amud, s.segment))
    .map((s) => ({
      id: s.id,
      x: s.x + (s.jitter?.x ?? 0),
      y: s.y + (s.jitter?.y ?? 0) + (s.size - SQUARE_GAP) / 2,
    }));

  return {
    items: allItems,
    tractateBlocks,
    perekAnchors: allPerekAnchors,
    dafRows: allDafRows,
    hadrans,
    bounds: { width: maxX, height: maxY },
  };
}
