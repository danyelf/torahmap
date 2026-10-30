// The VIS map's page, at /ieeevis/.
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { hold, openMap } from '../browser/page.ts';
import { IEEEVIS_STATES } from './app.ts';
import { testStates } from './check.ts';
import { standInTexts } from './visTexts.ts';
import { IEEEVIS_PATH } from '@torahmap/ieeevis/page.ts';
import { TEXTS_FILE } from '@torahmap/ieeevis/data.ts';

const texts = JSON.stringify(standInTexts());

test.beforeEach(async ({ page }) => {
  (await hold(page, [TEXTS_FILE], texts))();
});

test('the page reads the made-up texts', async ({ page }) => {
  const read = page.waitForResponse(`**/data/${TEXTS_FILE}`);
  await openMap(page, '', IEEEVIS_PATH);
  expect(await (await read).text()).toBe(texts);
});

testStates(IEEEVIS_STATES, IEEEVIS_PATH);
