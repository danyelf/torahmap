// What the reader's actions record.
import { expect, test } from '@playwright/test';
import {
  allLoaded,
  collectErrors,
  desktopOnly,
  hold,
  openMap,
  param,
  recordEvents,
  sentFields,
  sentSearches,
  viaMenu,
} from '../browser/page.ts';
import { SEARCH_REQUIRED } from '../browser/files.ts';

test.beforeEach(() => desktopOnly('what is recorded does not depend on the screen'));

test('stepping to a verse records it by its id and book', async ({ page }) => {
  const errors = await openMap(page, 'verse=Genesis.12.1');
  await recordEvents(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => param(page, 'verse')).not.toBe('Genesis.12.1');
  await expect
    .poll(() => sentFields(page, 'square_click'))
    .toEqual([{ id: param(page, 'verse'), area: 'Genesis' }]);
  expect(errors).toEqual([]);
});

test('a linked search is never recorded; a word the reader adds is', async ({ page }) => {
  // Held, so the recording is on before the linked search could run.
  const release = await hold(page, SEARCH_REQUIRED);
  const errors = collectErrors(page);
  await page.goto('/?search=light');
  await recordEvents(page);
  release();
  await allLoaded(page);
  await viaMenu(page, 'search');
  await page.locator('#add-term').click();
  await page.locator('.term-row[data-open="true"] .term-input').fill('dark');
  await expect.poll(() => sentSearches(page)).toEqual(['dark']);
  await allLoaded(page);
  expect(await sentSearches(page)).toEqual(['dark']);
  expect(errors).toEqual([]);
});
