// Where every swatch stands: a row per palette, and in it a cell per block size.

import type { MapItem } from '@torahmap/engine';
import type { Color } from '@torahmap/utils';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import { parseColor } from './color.ts';
import { BLOCK_GAP, LABEL_ROOM, ROW_GAP, SQUARE_SIZE as S } from './constants.ts';
import type { BlockSize, Palette } from './palettes.ts';

export interface SwatchItem extends MapItem {
  color: Color;
  /** The palette's name and the colour as written, for the popup. */
  palette: string;
  spec: string;
}

export interface SwatchLayout {
  items: SwatchItem[];
  books: BookBox[];
  bounds: { width: number; height: number };
}

export const blockName = ({ w, h }: BlockSize): string => `${w}×${h}`;

export function computeSwatchLayout(
  palettes: readonly Palette[],
  sizes: readonly BlockSize[],
): SwatchLayout {
  const items: SwatchItem[] = [];
  const books: BookBox[] = [];
  const widthOf = (palette: Palette, size: BlockSize) =>
    palette.colors.length * (size.w * S + BLOCK_GAP) - BLOCK_GAP;

  // Cells line up in columns across rows.
  const columnX: number[] = [];
  let x = 0;
  for (const size of sizes) {
    columnX.push(x);
    x += Math.max(...palettes.map((p) => widthOf(p, size))) + 2 * BLOCK_GAP;
  }
  const rowHeight = Math.max(...sizes.map((s) => s.h)) * S;

  let top = LABEL_ROOM;
  palettes.forEach((palette, p) => {
    sizes.forEach((size, s) => {
      palette.colors.forEach((spec, c) => {
        const color = parseColor(spec);
        const left = columnX[s] + c * (size.w * S + BLOCK_GAP);
        for (let row = 0; row < size.h; row++) {
          for (let col = 0; col < size.w; col++) {
            items.push({
              id: `p${p}.c${c}.${size.w}x${size.h}.${row}.${col}`,
              x: left + col * S,
              y: top + row * S,
              size: S,
              color,
              palette: palette.name,
              spec,
            });
          }
        }
      });
      books.push({
        name: blockName(size),
        hebrewName: '',
        section: palette.name,
        minX: columnX[s],
        maxX: columnX[s] + widthOf(palette, size),
        minY: top,
      });
    });
    top += rowHeight + ROW_GAP + LABEL_ROOM;
  });

  return { items, books, bounds: { width: x - 2 * BLOCK_GAP, height: top - ROW_GAP - LABEL_ROOM } };
}
