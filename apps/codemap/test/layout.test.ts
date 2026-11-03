import { describe, expect, it } from 'vitest';
import type { CodeFile, CodeStructure } from '../src/data.ts';
import type { WorldBox } from '@torahmap/engine';
import {
  CHAR,
  MAX_CHARS,
  MAX_ROWS,
  NAME_STRIP,
  ROW,
  SHADE_REACH,
  tabHeight,
} from '../src/constants.ts';
import { lineId, parseLineId } from '../src/ids.ts';
import { computeCodeLayout } from '../src/layout.ts';
import { fixtureStructure } from './helpers/fixture.ts';

function fileOf(path: string, indent: number[], length: number[]): CodeFile {
  const marks = { marks: '.'.repeat(indent.length), deletedBefore: [] };
  return {
    path,
    indent,
    length,
    kind: 'x'.repeat(indent.length),
    lastChanged: indent.map(() => 0),
    timesChanged: indent.map(() => 1),
    pr: marks,
    commits: [marks],
  };
}

const structureOf = (...files: CodeFile[]): CodeStructure => ({
  ...fixtureStructure,
  files,
});

const plain = (n: number) => Array<number>(n).fill(0);

describe('line ids', () => {
  it('round-trip, 1-based, with colons in the path', () => {
    expect(parseLineId(lineId('a:b.ts', 1))).toEqual({ path: 'a:b.ts', line: 1 });
  });
});

describe('computeCodeLayout', () => {
  it('starts a bar at its indent and ends it at its length', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', [4], [20])));
    const [bar] = items;
    expect(bar.id).toBe(lineId('a.ts', 1));
    expect(bar.width).toBe(16 * CHAR);
    expect(bar.size).toBe(ROW);
    expect(bar.x).toBe(4 * CHAR);
  });

  it('stacks a file one row apart in one column', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', plain(2), [5, 5])));
    expect(items[1].y - items[0].y).toBe(ROW);
    expect(items[1].x).toBe(items[0].x);
  });

  it('continues a long file in further columns', () => {
    const n = 2 * MAX_ROWS + 100;
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', plain(n), Array(n).fill(5))));
    const columns = [...new Set(items.map((i) => i.x))];
    expect(columns).toHaveLength(3);
    const inColumn = columns.map((x) => items.filter((i) => i.x === x).length);
    expect(inColumn).toEqual([MAX_ROWS, MAX_ROWS, 100]);
  });

  it('clips a long line at the column width', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', [0], [3000])));
    expect(items[0].width).toBe(MAX_CHARS * CHAR);
  });

  it('clips an indented long line at the column edge', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', [10], [3000])));
    expect(items[0].x + (items[0].width ?? 0)).toBe(MAX_CHARS * CHAR);
  });

  it('draws a deleted file as one marked bar', () => {
    const { items } = computeCodeLayout(fixtureStructure);
    const stubs = items.filter((i) => i.deletedFile);
    expect(stubs).toHaveLength(1);
    expect(items.filter((i) => i.file === stubs[0].file)).toHaveLength(1);
  });

  it('gives every item its own id', () => {
    const { items } = computeCodeLayout(fixtureStructure);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('contains every item in the bounds', () => {
    const { items, bounds } = computeCodeLayout(fixtureStructure);
    for (const i of items) {
      expect(i.x + (i.width ?? i.size)).toBeLessThanOrEqual(bounds.width);
      expect(i.y + i.size).toBeLessThanOrEqual(bounds.height);
    }
  });

  const tree = structureOf(
    fileOf('README.md', [0], [1]),
    fileOf('apps/x/src/a.ts', plain(300), Array(300).fill(5)),
    fileOf('apps/x/src/b.ts', [0], [1]),
    fileOf('apps/y/a.ts', [0], [1]),
    fileOf('docs/p.md', [0], [1]),
    fileOf('docs/q/r.md', [0], [1]),
  );

  const inside = (a: WorldBox, b: WorldBox) =>
    a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;
  const meet = (a: WorldBox, b: WorldBox) =>
    a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

  it('boxes every folder at every depth, outer folders first', () => {
    const { folders } = computeCodeLayout(tree);
    expect(folders.map((f) => f.name)).toEqual(['apps', 'docs', 'x', 'y', 'q', 'src']);
    expect(folders.map((f) => f.depth)).toEqual([1, 1, 2, 2, 2, 3]);
  });

  it('puts each folder inside the one that holds it, below its name strip', () => {
    const { folders } = computeCodeLayout(tree);
    const box = (name: string) => folders.find((f) => f.name === name)!;
    for (const [inner, outer] of [
      ['x', 'apps'],
      ['y', 'apps'],
      ['src', 'x'],
      ['q', 'docs'],
    ]) {
      expect(inside(box(inner), box(outer))).toBe(true);
      expect(box(inner).minY).toBeGreaterThanOrEqual(box(outer).minY + tabHeight(box(outer).depth));
    }
  });

  it('puts each file’s bars, name strip and shade inside its folder, apart from every other file', () => {
    const { folders, files, items } = computeCodeLayout(tree);
    const shaded = (f: WorldBox) => ({
      minX: f.minX - SHADE_REACH,
      minY: f.minY - NAME_STRIP - SHADE_REACH,
      maxX: f.maxX + SHADE_REACH,
      maxY: f.maxY + SHADE_REACH,
    });
    for (const file of files) {
      const path = tree.files[file.file].path;
      const folder = folders.find((f) => f.name === path.split('/').at(-2));
      if (folder) expect(inside(shaded(file), folder)).toBe(true);
      for (const bar of items.filter((i) => i.file === file.file)) {
        expect(
          inside(
            { minX: bar.x, minY: bar.y, maxX: bar.x + bar.width!, maxY: bar.y + bar.size },
            file,
          ),
        ).toBe(true);
      }
      for (const other of files.filter((f) => f !== file)) {
        expect(meet(shaded(file), shaded(other))).toBe(false);
      }
    }
  });

  it('names a file by the last part of its path', () => {
    const { files } = computeCodeLayout(tree);
    expect(files.map((f) => f.name)).toContain('r.md');
  });

  it('keeps two folders side by side from overlapping', () => {
    const { folders } = computeCodeLayout(tree);
    for (const a of folders) {
      for (const b of folders) {
        if (a !== b && a.depth === b.depth) expect(meet(a, b)).toBe(false);
      }
    }
  });
});
