// Where every line stands: a treemap, each folder a box inside the one that holds it and each
// file a box inside its folder, its area its line count. Every box is a whole number of columns
// wide, so a column is never narrower than COLUMN_CHARS; heights are free. A file's lines fill its
// columns top to bottom, at one line height unless the box is too short for them.

import type { Bounds, MapItem, WorldBox } from '@torahmap/engine';
import type { CodeFile, CodeStructure, LineKind } from './data.ts';
import {
  CHAR,
  COLUMN_CHARS,
  COLUMN_MARGIN,
  FILE_PAD,
  FOLDER_PAD,
  FOLDER_STRIP,
  MAP_ASPECT,
  PROSE_WEIGHT,
  ROW,
  SLACK,
  STUB_CHARS,
  isProse,
} from './constants.ts';
import { lineId } from './ids.ts';

export interface CodeItem extends MapItem {
  file: number; // index in structure.files
  line: number; // 1-based
  kind: LineKind;
  deletedFile: boolean;
}

/** A folder's box, its name strip at the top. */
export interface FolderBox extends WorldBox {
  name: string;
  depth: number; // the repository's own folders are 1
  strip: number; // the name strip's height
}

/** A file's box. */
export interface FileBox extends WorldBox {
  name: string;
  file: number;
}

export interface CodeLayout {
  items: CodeItem[];
  /** Outer folders before the folders inside them. */
  folders: FolderBox[];
  files: FileBox[];
  bounds: Bounds;
}

const COLUMN_WIDTH = COLUMN_CHARS * CHAR;
const UNIT = COLUMN_WIDTH + COLUMN_MARGIN; // one column and its margin

/** The folder a file is in, '' at the top of the repository. */
export const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0));

interface Node {
  name: string;
  depth: number; // the repository's own folders and files are 1
  file?: number;
  weight: number;
  inside: Node[];
}

const lineCount = (file: CodeFile) => (file.deleted ? 1 : Math.max(file.length.length, 1));

/** Each folder's files by name, then its folders by name. */
function tree(files: readonly CodeFile[]): Node {
  const root: Node = { name: '', depth: 0, weight: 0, inside: [] };
  const folders = new Map<string, Node>([['', root]]);
  files.forEach((file, index) => {
    const parts = file.path.split('/');
    let folder = root;
    for (let k = 0; k < parts.length - 1; k++) {
      const path = parts.slice(0, k + 1).join('/');
      let inner = folders.get(path);
      if (!inner) {
        inner = { name: parts[k], depth: k + 1, weight: 0, inside: [] };
        folders.set(path, inner);
        folder.inside.push(inner);
      }
      folder = inner;
    }
    const weight = lineCount(file) * (isProse(file.path) ? PROSE_WEIGHT : 1);
    folder.inside.push({
      name: parts.at(-1)!,
      depth: parts.length,
      file: index,
      weight,
      inside: [],
    });
  });
  const total = (n: Node): number =>
    n.file !== undefined ? n.weight : (n.weight = n.inside.reduce((sum, k) => sum + total(k), 0));
  total(root);
  const order = (n: Node) => {
    n.inside.sort(
      (a, b) =>
        Number(a.file === undefined) - Number(b.file === undefined) || a.name.localeCompare(b.name),
    );
    n.inside.forEach(order);
  };
  order(root);
  return root;
}

/** A box: its left edge and width in whole columns, its top and height in map units. */
interface Cell {
  column: number;
  columns: number;
  y: number;
  height: number;
}

/** A whole number of columns split by weight, each at least one, by largest remainder. */
function apportion(weights: number[], columns: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / total) * columns);
  const out = exact.map((x) => Math.max(1, Math.floor(x)));
  const byRemainder = exact
    .map((x, i) => [x - Math.floor(x), i])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  for (let left = columns - out.reduce((a, b) => a + b, 0), k = 0; left > 0; left--, k++) {
    out[byRemainder[k % byRemainder.length]]++;
  }
  // Raising the small ones to one column can overshoot; the widest give it back.
  for (let over = out.reduce((a, b) => a + b, 0) - columns; over > 0; over--) {
    out[out.indexOf(Math.max(...out))]--;
  }
  return out;
}

/**
 * Squarified treemap in the order given: items fill a strip down the left of the cell, or a row
 * across its top when it is taller than wide, as long as that keeps their boxes squarer.
 */
function squarify(items: readonly Node[], cell: Cell): Cell[] {
  const out: Cell[] = [];
  let { column, columns, y, height } = cell;
  let i = 0;
  const worst = (row: number[], side: number, scale: number) => {
    const sum = row.reduce((a, k) => a + items[k].weight * scale, 0);
    return Math.max(
      ...row.map((k) => {
        const area = items[k].weight * scale;
        return Math.max((side * side * area) / (sum * sum), (sum * sum) / (side * side * area));
      }),
    );
  };
  while (i < items.length) {
    const rest = items.slice(i).reduce((a, n) => a + n.weight, 0);
    const width = columns * UNIT;
    const scale = (width * height) / rest;
    const side = Math.min(width, height);
    const across = width < height;
    const row = [i++];
    while (
      i < items.length &&
      (!across || row.length < columns) &&
      // With one column left and a strip down it, everything left goes in that strip.
      ((columns === 1 && !across) || worst([...row, i], side, scale) <= worst(row, side, scale))
    ) {
      row.push(i++);
    }
    const weight = row.reduce((a, k) => a + items[k].weight, 0);
    if (across) {
      const rowHeight = i === items.length ? height : (weight * scale) / width;
      const widths = apportion(
        row.map((k) => items[k].weight),
        columns,
      );
      let at = column;
      row.forEach((k, j) => {
        out[k] = { column: at, columns: widths[j], y, height: rowHeight };
        at += widths[j];
      });
      y += rowHeight;
      height -= rowHeight;
    } else {
      // Leave a column for what comes after.
      const most = i === items.length ? columns : columns - 1;
      const stripColumns =
        i === items.length
          ? columns
          : Math.min(most, Math.max(1, Math.round((weight * scale) / height / UNIT)));
      let at = y;
      for (const k of row) {
        const h = (items[k].weight / weight) * height;
        out[k] = { column, columns: stripColumns, y: at, height: h };
        at += h;
      }
      column += stripColumns;
      columns -= stripColumns;
    }
  }
  return out;
}

function placeFile(file: CodeFile, index: number, name: string, cell: Cell, out: CodeLayout) {
  const lines = lineCount(file);
  const nominal = isProse(file.path) ? ROW * PROSE_WEIGHT : ROW;
  const pad = Math.min(FILE_PAD, cell.height / 4);
  const top = cell.y + pad;
  const height = cell.height - 2 * pad;
  let perColumn = Math.max(1, Math.floor(height / nominal));
  let row = nominal;
  if (perColumn * cell.columns < lines) {
    perColumn = Math.ceil(lines / cell.columns);
    row = height / perColumn;
  }
  const left = cell.column * UNIT + COLUMN_MARGIN / 2;
  out.files.push({
    name,
    file: index,
    minX: left,
    minY: top,
    maxX: (cell.column + cell.columns) * UNIT - COLUMN_MARGIN / 2,
    maxY: top + height,
  });
  if (file.deleted) {
    out.items.push({
      id: lineId(file.path, 1),
      x: left,
      y: top,
      size: row,
      width: STUB_CHARS * CHAR,
      file: index,
      line: 1,
      kind: 'x',
      deletedFile: true,
    });
    return;
  }
  for (let i = 0; i < lines; i++) {
    const x = left + Math.floor(i / perColumn) * UNIT;
    const y = top + (i % perColumn) * row;
    const indent = Math.min(file.indent[i], COLUMN_CHARS - 1);
    out.items.push({
      id: lineId(file.path, i + 1),
      x: x + indent * CHAR,
      y,
      size: row,
      width: Math.min(Math.max(file.length[i] - indent, 1), COLUMN_CHARS - indent) * CHAR,
      file: index,
      line: i + 1,
      kind: file.kind[i] as LineKind,
      deletedFile: false,
    });
  }
}

/** A folder's edges sit in the column margins, each depth further in, short of the lines. */
const edgeInset = (depth: number) => Math.min(depth, COLUMN_MARGIN / 2 - 1);

function place(node: Node, cell: Cell, files: readonly CodeFile[], out: CodeLayout) {
  if (node.file !== undefined) {
    placeFile(files[node.file], node.file, node.name, cell, out);
    return;
  }
  let inner = cell;
  if (node.depth > 0) {
    const strip = Math.min(FOLDER_STRIP, cell.height / 4);
    const pad = Math.min(FOLDER_PAD, cell.height / 4);
    out.folders.push({
      name: node.name,
      depth: node.depth,
      strip,
      minX: cell.column * UNIT + edgeInset(node.depth),
      minY: cell.y,
      maxX: (cell.column + cell.columns) * UNIT - edgeInset(node.depth),
      maxY: cell.y + cell.height,
    });
    inner = { ...cell, y: cell.y + strip, height: cell.height - strip - pad };
  }
  const cells = squarify(node.inside, inner);
  node.inside.forEach((k, i) => place(k, cells[i], files, out));
}

export function computeCodeLayout(structure: CodeStructure): CodeLayout {
  const out: CodeLayout = { items: [], folders: [], files: [], bounds: { width: 0, height: 0 } };
  const root = tree(structure.files);
  const area = root.weight * UNIT * ROW * SLACK;
  const columns = Math.max(1, Math.round(Math.sqrt(area * MAP_ASPECT) / UNIT));
  const height = area / (columns * UNIT);
  place(root, { column: 0, columns, y: 0, height }, structure.files, out);
  out.folders.sort((a, b) => a.depth - b.depth);
  out.bounds = { width: columns * UNIT, height };
  return out;
}
