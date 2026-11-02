import { describe, expect, it } from 'vitest';
import type { CodeFile, CodeStructure } from '../src/data.ts';
import { CHAR, MAX_CHARS, MAX_ROWS, ROW } from '../src/constants.ts';
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

  it('groups files by folder, apps and packages by two parts', () => {
    const { books } = computeCodeLayout(
      structureOf(
        fileOf('README.md', [0], [1]),
        fileOf('apps/x/src/a.ts', [0], [1]),
        fileOf('apps/x/src/b.ts', [0], [1]),
        fileOf('apps/y/a.ts', [0], [1]),
        fileOf('docs/p.md', [0], [1]),
        fileOf('docs/q/r.md', [0], [1]),
      ),
    );
    expect(books.map((b) => b.name)).toEqual(['(root)', 'apps/x', 'apps/y', 'docs']);
  });

  it('wraps groups into a new band below', () => {
    const files = Array.from({ length: 400 }, (_, i) =>
      fileOf(`g${i}/a.ts`, plain(10), Array(10).fill(5)),
    );
    const { books, bounds } = computeCodeLayout(structureOf(...files));
    expect(new Set(books.map((b) => b.minY)).size).toBeGreaterThan(1);
    expect(Math.max(...books.map((b) => b.maxX))).toBeLessThanOrEqual(bounds.width);
  });
});
