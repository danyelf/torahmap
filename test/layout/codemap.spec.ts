// The code map's page, at /codemap/.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { openMap } from '../browser/page.ts';
import { boxes } from './page.ts';
import { CODEMAP_STATES } from './app.ts';
import { testPanelsOpen, testStates } from './check.ts';
import { overlapping } from './geometry.ts';
import { CODEMAP_PATH } from '@torahmap/codemap/page.ts';
import { computeCodeLayout } from '@torahmap/codemap/layout.ts';

const laid = computeCodeLayout(
  JSON.parse(
    readFileSync(new URL('../../public/data/codemap/structure.json', import.meta.url), 'utf8'),
  ),
);

const FOLDER_NAMES = '#codemap-labels .folder-name';
const FILE_NAMES = '#codemap-labels .file-name';

// A folder with folders inside it and files beside them.
const codemap = laid.folders.find((f) => f.name === 'codemap')!;
const at = `x=${codemap.minX}&y=${codemap.minY}`;

testStates(CODEMAP_STATES, CODEMAP_PATH);
testPanelsOpen(CODEMAP_PATH);

for (const zoom of [0.05, 0.25, 1.5]) {
  test(`at zoom ${zoom}, no two folder or file names overlap`, async ({ page }) => {
    await openMap(page, `zoom=${zoom}&${at}`, CODEMAP_PATH);
    const names = [...(await boxes(page, FOLDER_NAMES)), ...(await boxes(page, FILE_NAMES))];
    expect(names).not.toEqual([]);
    expect(overlapping(names)).toEqual([]);
  });
}

test('names files once zoomed in, and only folders when zoomed out', async ({ page }) => {
  await openMap(page, `zoom=0.05&${at}`, CODEMAP_PATH);
  expect(await boxes(page, FILE_NAMES)).toEqual([]);
  await openMap(page, `zoom=1.5&${at}`, CODEMAP_PATH);
  expect(await boxes(page, FILE_NAMES)).not.toEqual([]);
});
