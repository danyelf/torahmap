// Where every line stands: a column per file, files grouped by folder, groups flowing into bands.

import type { Bounds, MapItem } from '@torahmap/engine';
import type { BookBox } from '@torahmap/shell/mapLabels.ts';
import type { CodeFile, CodeStructure, LineKind } from './data.ts';
import {
  BAND_GAP,
  CHAR,
  FILE_GAP,
  MAX_CHARS,
  MAX_ROWS,
  MAX_WIDTH,
  ROW,
  STUB_CHARS,
} from './constants.ts';
import { lineId } from './ids.ts';

export interface CodeItem extends MapItem {
  file: number; // index in structure.files
  line: number; // 1-based
  kind: LineKind;
  deletedFile: boolean;
}

export interface CodeLayout {
  items: CodeItem[];
  books: BookBox[];
  bounds: Bounds;
}

const COLUMN_WIDTH = MAX_CHARS * CHAR;

/** The folder a file is grouped under. */
export function groupOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root)';
  const deep = parts[0] === 'apps' || parts[0] === 'packages';
  return deep && parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

/** A file's bars with x measured from the group's left edge and y from its top. */
function placeFile(
  file: CodeFile,
  index: number,
  left: number,
): { items: CodeItem[]; right: number; height: number } {
  if (file.deleted) {
    const width = STUB_CHARS * CHAR;
    const item: CodeItem = {
      id: lineId(file.path, 1),
      x: left,
      y: 0,
      size: ROW,
      width,
      file: index,
      line: 1,
      kind: 'x',
      deletedFile: true,
    };
    return { items: [item], right: left + width, height: ROW };
  }
  const items = file.length.map((length, i): CodeItem => {
    const column = Math.floor(i / MAX_ROWS);
    const indent = Math.min(file.indent[i], MAX_CHARS - 1);
    const columnX = left + column * (COLUMN_WIDTH + FILE_GAP);
    return {
      id: lineId(file.path, i + 1),
      x: columnX + indent * CHAR,
      y: (i % MAX_ROWS) * ROW,
      size: ROW,
      width: Math.min(Math.max(length - indent, 1), MAX_CHARS - indent) * CHAR,
      file: index,
      line: i + 1,
      kind: file.kind[i] as LineKind,
      deletedFile: false,
    };
  });
  const columns = Math.max(1, Math.ceil(file.length.length / MAX_ROWS));
  return {
    items,
    right: left + (columns - 1) * (COLUMN_WIDTH + FILE_GAP) + COLUMN_WIDTH,
    height: Math.min(file.length.length, MAX_ROWS) * ROW,
  };
}

export function computeCodeLayout(structure: CodeStructure): CodeLayout {
  const groups = new Map<string, number[]>();
  structure.files.forEach((file, i) => {
    const name = groupOf(file.path);
    groups.set(name, [...(groups.get(name) ?? []), i]);
  });

  const items: CodeItem[] = [];
  const books: BookBox[] = [];
  let bandTop = BAND_GAP;
  let bandHeight = 0;
  let x = 0;
  let width = 0;

  for (const [name, indexes] of groups) {
    const placed = [];
    let right = 0;
    let height = 0;
    for (const index of indexes) {
      const p = placeFile(structure.files[index], index, right ? right + FILE_GAP : 0);
      placed.push(p);
      right = p.right;
      height = Math.max(height, p.height);
    }
    if (x && x + right > MAX_WIDTH) {
      bandTop += bandHeight + BAND_GAP;
      bandHeight = 0;
      x = 0;
    }
    for (const p of placed) {
      for (const item of p.items) {
        item.x += x;
        item.y += bandTop;
        items.push(item);
      }
    }
    books.push({ name, hebrewName: '', section: name, minX: x, maxX: x + right, minY: bandTop });
    bandHeight = Math.max(bandHeight, height);
    width = Math.max(width, x + right);
    x += right + FILE_GAP * 2;
  }

  return { items, books, bounds: { width, height: bandTop + bandHeight } };
}
