// Where every line stands: each folder a box, at every depth, holding its files and then its
// folders, packed in shelves; each file a column of bars, continued in further columns when long.

import type { Bounds, MapItem, WorldBox } from '@torahmap/engine';
import type { CodeFile, CodeStructure, LineKind } from './data.ts';
import {
  CHAR,
  COLUMN_GAP,
  FILE_GAP,
  FOLDER_ASPECT,
  FOLDER_PAD,
  MAX_CHARS,
  MAX_ROWS,
  NAME_STRIP,
  ROW,
  SHELF_GAP,
  STUB_CHARS,
  tabHeight,
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
}

/** A file's columns of bars, below its name strip. */
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

const COLUMN_WIDTH = MAX_CHARS * CHAR;

/** The folder a file is in, '' at the top of the repository. */
export const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0));

interface Folder {
  name: string;
  depth: number;
  files: number[];
  folders: Map<string, Folder>;
}

function folderTree(files: readonly CodeFile[]): Folder {
  const root: Folder = { name: '', depth: 0, files: [], folders: new Map() };
  files.forEach((file, index) => {
    let folder = root;
    for (const name of file.path.split('/').slice(0, -1)) {
      let inner = folder.folders.get(name);
      if (!inner) {
        inner = { name, depth: folder.depth + 1, files: [], folders: new Map() };
        folder.folders.set(name, inner);
      }
      folder = inner;
    }
    folder.files.push(index);
  });
  return root;
}

/** Something packed, its size and how to place it once its top-left corner is known. */
interface Packed {
  width: number;
  height: number;
  place(x: number, y: number, out: CodeLayout): void;
}

/** A file's bars, with its name strip above them. */
function packFile(file: CodeFile, index: number): Packed {
  const rows = file.deleted ? 1 : file.length.length;
  const columns = Math.max(1, Math.ceil(rows / MAX_ROWS));
  const width = columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP;
  return {
    width,
    height: NAME_STRIP + Math.max(1, Math.min(rows, MAX_ROWS)) * ROW,
    place(x, y, out) {
      const top = y + NAME_STRIP;
      out.files.push({
        name: file.path.slice(file.path.lastIndexOf('/') + 1),
        file: index,
        minX: x,
        minY: top,
        maxX: x + width,
        maxY: top + Math.max(1, Math.min(rows, MAX_ROWS)) * ROW,
      });
      if (file.deleted) {
        out.items.push({
          id: lineId(file.path, 1),
          x,
          y: top,
          size: ROW,
          width: STUB_CHARS * CHAR,
          file: index,
          line: 1,
          kind: 'x',
          deletedFile: true,
        });
        return;
      }
      file.length.forEach((length, i) => {
        const indent = Math.min(file.indent[i], MAX_CHARS - 1);
        out.items.push({
          id: lineId(file.path, i + 1),
          x: x + Math.floor(i / MAX_ROWS) * (COLUMN_WIDTH + COLUMN_GAP) + indent * CHAR,
          y: top + (i % MAX_ROWS) * ROW,
          size: ROW,
          width: Math.min(Math.max(length - indent, 1), MAX_CHARS - indent) * CHAR,
          file: index,
          line: i + 1,
          kind: file.kind[i] as LineKind,
          deletedFile: false,
        });
      });
    },
  };
}

/**
 * A folder's files, then its folders, each set by name, left to right in shelves as wide as
 * the widest of them or as makes the whole about FOLDER_ASPECT wide to tall.
 */
function packFolder(folder: Folder, files: readonly CodeFile[]): Packed {
  const byName = (a: string, b: string) => a.localeCompare(b);
  const inside = [
    ...folder.files.map((i) => packFile(files[i], i)),
    ...[...folder.folders.values()]
      .sort((a, b) => byName(a.name, b.name))
      .map((f) => packFolder(f, files)),
  ];
  const area = inside.reduce((sum, p) => sum + (p.width + FILE_GAP) * (p.height + SHELF_GAP), 0);
  const shelfWidth = Math.max(...inside.map((p) => p.width), Math.sqrt(area * FOLDER_ASPECT));

  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let innerWidth = 0;
  for (const p of inside) {
    if (x > 0 && x + p.width > shelfWidth) {
      x = 0;
      y += shelfHeight + SHELF_GAP;
      shelfHeight = 0;
    }
    at.push({ x, y });
    innerWidth = Math.max(innerWidth, x + p.width);
    shelfHeight = Math.max(shelfHeight, p.height);
    x += p.width + FILE_GAP;
  }

  const top = folder.depth === 0 ? 0 : tabHeight(folder.depth);
  const pad = folder.depth === 0 ? 0 : FOLDER_PAD;
  const width = innerWidth + 2 * pad;
  const height = top + y + shelfHeight + pad;
  return {
    width,
    height,
    place(left, upper, out) {
      if (folder.depth > 0) {
        out.folders.push({
          name: folder.name,
          depth: folder.depth,
          minX: left,
          minY: upper,
          maxX: left + width,
          maxY: upper + height,
        });
      }
      inside.forEach((p, i) => p.place(left + pad + at[i].x, upper + top + at[i].y, out));
    },
  };
}

export function computeCodeLayout(structure: CodeStructure): CodeLayout {
  const out: CodeLayout = { items: [], folders: [], files: [], bounds: { width: 0, height: 0 } };
  const root = packFolder(folderTree(structure.files), structure.files);
  root.place(0, 0, out);
  out.folders.sort((a, b) => a.depth - b.depth);
  out.bounds = { width: root.width, height: root.height };
  return out;
}
