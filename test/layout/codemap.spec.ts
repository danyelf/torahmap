// The code map's page, at /codemap/.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { openMap } from '../browser/page.ts';
import { boxes } from './page.ts';
import { CODEMAP_STATES } from './app.ts';
import { testPanelsOpen, testStates } from './check.ts';
import { apart, overlapping, type Box } from './geometry.ts';
import { CODEMAP_PATH } from '@torahmap/codemap/page.ts';
import { FOLDER_LABEL, MAX_ROWS } from '@torahmap/codemap/constants.ts';
import { computeCodeLayout } from '@torahmap/codemap/layout.ts';

const laid = computeCodeLayout(
  JSON.parse(
    readFileSync(new URL('../../public/data/codemap/structure.json', import.meta.url), 'utf8'),
  ),
);

const NAMES = '#codemap-folders .row-number';

/**
 * The box of each file's column of bars, in map units. A bar is under a pixel tall when zoomed
 * out, too thin to measure an overlap against, so a name is checked against the column.
 */
const columns = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
for (const bar of laid.items) {
  const name = `${bar.file}.${Math.floor((bar.line - 1) / MAX_ROWS)}`;
  const c = columns.get(name) ?? {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  c.minX = Math.min(c.minX, bar.x);
  c.minY = Math.min(c.minY, bar.y);
  c.maxX = Math.max(c.maxX, bar.x + bar.width!);
  c.maxY = Math.max(c.maxY, bar.y + bar.size);
  columns.set(name, c);
}

/** The columns on screen, placed from where the first drawn folder name stands. */
async function columnsOnScreen(page: Page, zoom: number): Promise<Box[]> {
  const [anchor] = await page.$$eval(NAMES, (els) =>
    els
      .map((el) => ({ text: el.textContent ?? '', box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0)
      .map(({ text, box }) => ({ text, x: box.left, bottom: box.bottom })),
  );
  const book = laid.books.find((b) => b.name === anchor.text)!;
  const view = (await boxes(page, '#canvas'))[0];
  return [...columns]
    .map(([name, c]) => ({
      name,
      x: anchor.x + (c.minX - book.minX) * zoom,
      y: anchor.bottom + FOLDER_LABEL.offset + (c.minY - book.minY) * zoom,
      width: (c.maxX - c.minX) * zoom,
      height: (c.maxY - c.minY) * zoom,
    }))
    .filter((c) => apart([c], [view]).length > 0);
}

// The second band's first folder, whose name stands between two bands.
const between = laid.books.find((b) => b.minY > laid.books[0].minY)!;

testStates(CODEMAP_STATES, CODEMAP_PATH);
testPanelsOpen(CODEMAP_PATH);

for (const zoom of [0.07, 0.25]) {
  test(`at zoom ${zoom}, folder names run into neither each other nor the bars`, async ({
    page,
  }) => {
    await openMap(page, `zoom=${zoom}&x=${between.minX}&y=${between.minY}`, CODEMAP_PATH);
    const names = await boxes(page, NAMES);
    expect(names).not.toEqual([]);
    expect(overlapping(names)).toEqual([]);
    expect(apart(names, await columnsOnScreen(page, zoom))).toEqual([]);
  });
}
