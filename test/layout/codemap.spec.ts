// The code map's page, at /codemap/.
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { openMap } from '../browser/page.ts';
import { boxes } from './page.ts';
import { CODEMAP_STATES } from './app.ts';
import { testPanelsOpen, testStates } from './check.ts';
import { overlapping } from './geometry.ts';
import { CODEMAP_PATH } from '@torahmap/codemap/page.ts';

testStates(CODEMAP_STATES, CODEMAP_PATH);
testPanelsOpen(CODEMAP_PATH);

for (const zoom of [0.02, 0.08, 0.25]) {
  test(`at zoom ${zoom}, no two folder names overlap`, async ({ page }) => {
    await openMap(page, `zoom=${zoom}&x=0&y=0`, CODEMAP_PATH);
    const names = await boxes(page, '#codemap-folders .row-number');
    expect(names).not.toEqual([]);
    expect(overlapping(names)).toEqual([]);
  });
}
