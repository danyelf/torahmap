import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../../src/layout.ts';
import type { TanakhLayout, TorahData } from '../../../src/types.ts';
import { PSALMS_COLUMNS, printLayout } from '../layout.ts';

const structure: TorahData = JSON.parse(readFileSync('public/data/tanakh-structure.json', 'utf8'));
const key = (v: TanakhLayout) => `${v.book}:${v.chapter}:${v.verse}`;

function box(vs: TanakhLayout[]) {
  return {
    minX: Math.min(...vs.map((v) => v.x)),
    maxX: Math.max(...vs.map((v) => v.x + v.size)),
    minY: Math.min(...vs.map((v) => v.y)),
    maxY: Math.max(...vs.map((v) => v.y + v.size)),
  };
}
type Box = ReturnType<typeof box>;
const overlap = (a: Box, b: Box) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

describe('printLayout', () => {
  const site = computeLayout(structure);
  const print = printLayout(structure);

  it('holds every verse of the site exactly once', () => {
    expect(print.map(key).sort()).toEqual(site.map(key).sort());
  });

  it('keeps each Psalm whole, with its own verses', () => {
    const psalms = structure.books.find((b) => b.name === 'Psalms')!;
    psalms.chapters.forEach((count, i) => {
      const verses = print.filter((v) => v.book === 'Psalms' && v.chapter === i + 1);
      expect(verses.map((v) => v.verse).sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, j) => j + 1),
      );
    });
  });

  it('sets Psalms in three columns that clear each other and every other book', () => {
    const [, second, third] = PSALMS_COLUMNS;
    const psalms = print.filter((v) => v.book === 'Psalms');
    const columns = [
      psalms.filter((v) => v.chapter < second),
      psalms.filter((v) => v.chapter >= second && v.chapter < third),
      psalms.filter((v) => v.chapter >= third),
    ].map(box);
    const others = [...new Set(print.map((v) => v.book))]
      .filter((b) => b !== 'Psalms')
      .map((b) => box(print.filter((v) => v.book === b)));
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        expect(overlap(columns[i], columns[j])).toBe(false);
      }
      for (const other of others) expect(overlap(columns[i], other)).toBe(false);
    }
  });

  it('makes the map shorter than the site’s', () => {
    const height = (vs: TanakhLayout[]) => box(vs).maxY - box(vs).minY;
    expect(height(print)).toBeLessThan(height(site));
  });
});
