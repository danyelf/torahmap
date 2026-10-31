// The VIS map's page, at /ieeevis/.
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { hold, openMap } from '../browser/page.ts';
import { IEEEVIS_STATES } from './app.ts';
import { testPanelsOpen, testStates } from './check.ts';
import { standInTextsFile } from './visTexts.ts';
import { IEEEVIS_PATH } from '@torahmap/ieeevis/page.ts';
import { TEXTS_FILE } from '@torahmap/ieeevis/data.ts';

const texts = standInTextsFile();

test.beforeEach(async ({ page }) => {
  (await hold(page, [TEXTS_FILE], texts))();
});

test('the page reads the made-up texts', async ({ page }) => {
  const read = page.waitForResponse(`**/data/${TEXTS_FILE}`);
  await openMap(page, '', IEEEVIS_PATH);
  expect(Buffer.from(await (await read).body())).toEqual(texts);
});

testStates(IEEEVIS_STATES, IEEEVIS_PATH);
testPanelsOpen(IEEEVIS_PATH);

test('the menu offers no Go to, since a paper has no reference to type', async ({ page }) => {
  await openMap(page, '', IEEEVIS_PATH);
  await page.locator('#menu-toggle').click();
  await expect(page.locator('.menu-item[data-action="search"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-action="goto"]')).toHaveCount(0);
});
