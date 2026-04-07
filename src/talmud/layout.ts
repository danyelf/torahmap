// Bookshelf layout for the Talmud map.
//
// Design: docs/plans/2026-04-07-talmud-integration-design.md §3.6
//
// - Each tractate is an "option C" perek-block (vertical blocks of amud-rows,
//   shared right edge, RTL within each row).
// - Sedarim are stacked vertically (top to bottom in canonical order).
// - Within a shelf, tractates are arranged right-to-left (RTL reading).
// - Tractates on a shelf are top-aligned.
// - Final coordinates have minX >= 0 (shifted into the first quadrant for
//   compatibility with the existing camera/render pipeline).

import type { SpatialItem, TalmudIdentity } from "../types.ts";
import type { TalmudStructure, TalmudTractate } from "./data.ts";
import {
  SEGMENT_SIZE,
  PEREK_GAP,
  TRACTATE_GAP,
  SEDER_GAP,
  TRACTATE_LABEL_HEIGHT,
  SEDER_ORDER,
} from "./constants.ts";

export type TalmudLayoutItem = SpatialItem<TalmudIdentity>;

export interface TractateBlock {
  name: string;
  hebrewName: string;
  seder: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  labelAnchor: { x: number; y: number };
}

export interface SederBlock {
  name: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TalmudLayoutResult {
  items: TalmudLayoutItem[];
  tractateBlocks: TractateBlock[];
  sederBlocks: SederBlock[];
  bounds: { width: number; height: number };
}

// ============================================================================
// Per-tractate layout (option C)
// ============================================================================

interface AmudRow {
  daf: number;
  amud: "a" | "b";
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
    // Skip empty amudim (Sefaria-Export pads leading dapim 1a/1b with empty
    // arrays so every Bavli tractate is indexed from daf 1).
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

interface LaidOutTractate {
  name: string;
  hebrewName: string;
  seder: string;
  items: TalmudLayoutItem[];
  // Local coordinates: origin (0, 0) = top-right. x is <= 0; y is >= 0.
  width: number;
  height: number;
}

/**
 * Lay out one tractate in local coordinates (top-right at 0,0).
 * Each row grows leftward (RTL); rows stack top-to-bottom within a perek;
 * perakim are separated by PEREK_GAP.
 */
function layoutTractate(tractate: TalmudTractate): LaidOutTractate {
  const rows = rowsForTractate(tractate);
  const items: TalmudLayoutItem[] = [];

  let y = 0;
  let lastPerekIdx = -1;
  let maxWidth = 0;

  for (const row of rows) {
    if (lastPerekIdx !== -1 && row.perekIdx !== lastPerekIdx) {
      y += PEREK_GAP;
    }
    lastPerekIdx = row.perekIdx;

    const rowWidth = row.segments.length * SEGMENT_SIZE;
    if (rowWidth > maxWidth) maxWidth = rowWidth;

    // Segments flow right-to-left. Segment 1 is rightmost.
    // Use x for the LEFT edge of each square. The rightmost segment's left
    // edge is at x = -SEGMENT_SIZE (so its right edge is at x = 0).
    for (let i = 0; i < row.segments.length; i++) {
      const seg = row.segments[i];
      const x = -(i + 1) * SEGMENT_SIZE;
      items.push({
        tractate: tractate.name,
        daf: row.daf,
        amud: row.amud,
        segment: seg.segment,
        x,
        y,
        size: SEGMENT_SIZE,
      });
    }

    y += SEGMENT_SIZE;
  }

  return {
    name: tractate.name,
    hebrewName: tractate.hebrewName,
    seder: tractate.seder,
    items,
    width: maxWidth,
    height: y,
  };
}

// ============================================================================
// Bookshelf arrangement
// ============================================================================

export function computeTalmudLayout(
  structure: TalmudStructure,
): TalmudLayoutResult {
  // 1. Lay out each tractate in local coordinates.
  const laid = structure.tractates.map(layoutTractate);

  // 2. Group by seder (canonical order, keeps unknown sedarim at the end).
  const bySeder = new Map<string, LaidOutTractate[]>();
  for (const seder of SEDER_ORDER) {
    bySeder.set(seder, []);
  }
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
  const sederBlocks: SederBlock[] = [];

  let shelfY = 0;
  const sedarimInOrder = [
    ...SEDER_ORDER,
    ...[...bySeder.keys()].filter((k) => !SEDER_ORDER.includes(k)),
  ];

  for (const seder of sedarimInOrder) {
    const tractates = bySeder.get(seder) ?? [];
    if (tractates.length === 0) continue;

    let shelfRightEdge = 0;
    let shelfMaxHeight = 0;

    for (const t of tractates) {
      const tractateRightEdge = shelfRightEdge;
      const tractateLeftEdge = tractateRightEdge - t.width;
      const tractateTop = shelfY + TRACTATE_LABEL_HEIGHT;
      const tractateBottom = tractateTop + t.height;

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
        seder: t.seder,
        minX: tractateLeftEdge,
        minY: shelfY,
        maxX: tractateRightEdge,
        maxY: tractateBottom,
        labelAnchor: {
          x: tractateRightEdge - t.width / 2,
          y: shelfY + TRACTATE_LABEL_HEIGHT / 2,
        },
      });

      if (tractateBottom - shelfY > shelfMaxHeight) {
        shelfMaxHeight = tractateBottom - shelfY;
      }
      shelfRightEdge = tractateLeftEdge - TRACTATE_GAP;
    }

    const shelfLeftEdge = shelfRightEdge + TRACTATE_GAP; // back off the last step
    sederBlocks.push({
      name: seder,
      minX: shelfLeftEdge,
      minY: shelfY,
      maxX: 0,
      maxY: shelfY + shelfMaxHeight,
    });

    shelfY += shelfMaxHeight + SEDER_GAP;
  }

  // 4. Shift everything so minX >= 0.
  let globalMinX = 0;
  for (const item of allItems) {
    if (item.x < globalMinX) globalMinX = item.x;
  }
  const dx = -globalMinX;
  for (const item of allItems) {
    item.x += dx;
  }
  for (const block of tractateBlocks) {
    block.minX += dx;
    block.maxX += dx;
    block.labelAnchor.x += dx;
  }
  for (const block of sederBlocks) {
    block.minX += dx;
    block.maxX += dx;
  }

  // 5. Compute bounds
  let maxX = 0;
  let maxY = 0;
  for (const item of allItems) {
    if (item.x + item.size > maxX) maxX = item.x + item.size;
    if (item.y + item.size > maxY) maxY = item.y + item.size;
  }

  return {
    items: allItems,
    tractateBlocks,
    sederBlocks,
    bounds: { width: maxX, height: maxY },
  };
}
