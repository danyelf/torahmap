import { describe, expect, it } from 'vitest';
import type { CodeFile, CodeStructure } from '../src/data.ts';
import type { WorldBox } from '@torahmap/engine';
import { CHAR, COLUMN_CHARS, PROSE_WEIGHT, ROW } from '../src/constants.ts';
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
    lastChange: indent.map(() => 0),
    commitCount: 1,
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
    const { items, files } = computeCodeLayout(structureOf(fileOf('a.ts', [4], [20])));
    const [bar] = items;
    expect(bar.id).toBe(lineId('a.ts', 1));
    expect(bar.width).toBe(16 * CHAR);
    expect(bar.size).toBe(ROW);
    expect(bar.x - files[0].minX).toBe(4 * CHAR);
  });

  it('stacks a file one row apart in one column', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', plain(20), Array(20).fill(5))));
    expect(items[1].y - items[0].y).toBe(ROW);
    expect(items[1].x).toBe(items[0].x);
  });

  it('gives prose lines a third of the height', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.md', [0], [5])));
    expect(items[0].size).toBe(ROW * PROSE_WEIGHT);
  });

  it("fills a file's columns top to bottom, each a whole column apart and every column full but the last", () => {
    const n = 5000;
    const { items } = computeCodeLayout(
      structureOf(
        fileOf('a.ts', plain(n), Array(n).fill(5)),
        fileOf('b.ts', plain(n), Array(n).fill(5)),
      ),
    );
    const bars = items.filter((i) => i.file === 0);
    const columns = [...new Set(bars.map((i) => i.x))];
    expect(columns.length).toBeGreaterThan(1);
    const gaps = columns.slice(1).map((x, k) => x - columns[k]);
    for (const gap of gaps) expect(gap).toBe(gaps[0]);
    expect(gaps[0]).toBeGreaterThan(COLUMN_CHARS * CHAR);
    const inColumn = columns.map((x) => bars.filter((i) => i.x === x).length);
    for (const count of inColumn.slice(0, -1)) expect(count).toBe(inColumn[0]);
    expect(inColumn.at(-1)).toBeLessThanOrEqual(inColumn[0]);
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].x === bars[i - 1].x) expect(bars[i].y).toBeGreaterThan(bars[i - 1].y);
    }
  });
  it('clips a long line at the column width', () => {
    const { items } = computeCodeLayout(structureOf(fileOf('a.ts', [0], [3000])));
    expect(items[0].width).toBe(COLUMN_CHARS * CHAR);
  });

  it('clips an indented long line at the column edge', () => {
    const { items, files } = computeCodeLayout(structureOf(fileOf('a.ts', [10], [3000])));
    expect(items[0].x + (items[0].width ?? 0) - files[0].minX).toBe(COLUMN_CHARS * CHAR);
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
      expect(box(inner).minY).toBeGreaterThanOrEqual(box(outer).minY + box(outer).strip);
    }
  });

  it('puts each file’s bars inside its box, and its box inside its folder, apart from every other file', () => {
    const { folders, files, items } = computeCodeLayout(tree);
    for (const file of files) {
      const path = tree.files[file.file].path;
      const folder = folders.find((f) => f.name === path.split('/').at(-2));
      if (folder) expect(inside(file, folder)).toBe(true);
      for (const bar of items.filter((i) => i.file === file.file)) {
        expect(
          inside(
            { minX: bar.x, minY: bar.y, maxX: bar.x + bar.width!, maxY: bar.y + bar.size },
            file,
          ),
        ).toBe(true);
      }
      for (const other of files.filter((f) => f !== file)) {
        expect(meet(file, other)).toBe(false);
      }
    }
  });

  it('keeps every file apart and inside its folder, whatever the sizes', () => {
    const sizes = [3000, 2, 1, 1, 400, 5, 1, 900, 1, 1, 1, 60, 2500, 1, 7, 1, 1, 120];
    const many = structureOf(
      ...sizes.map((n, i) =>
        fileOf(`${['a', 'a/b', 'c', 'c/d/e'][i % 4]}/f${i}.ts`, plain(n), Array(n).fill(5)),
      ),
    );
    const { files, folders } = computeCodeLayout(many);
    for (const file of files) {
      const path = many.files[file.file].path;
      for (const folder of folders.filter((f) => path.split('/').includes(f.name))) {
        expect(inside(file, folder)).toBe(true);
      }
      for (const other of files.filter((f) => f !== file)) expect(meet(file, other)).toBe(false);
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
