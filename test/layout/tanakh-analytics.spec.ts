// What the reader's actions record.
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
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
import { goTo } from './app.ts';

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

test('going to a place records what was typed and where it led', async ({ page }) => {
  const errors = await openMap(page, '');
  await recordEvents(page);
  await goTo(page, 'gen 2:2', true);
  await expect
    .poll(() => sentFields(page, 'go_to'))
    .toEqual([{ typed: 'gen 2:2', ref: 'Genesis 2:2', area: 'Genesis' }]);
  expect(errors).toEqual([]);
});

test('Enter on a reference that names no place records what was typed', async ({ page }) => {
  const errors = await openMap(page, '');
  await recordEvents(page);
  await goTo(page, 'Genesis 99', true);
  await expect
    .poll(() => sentFields(page, 'go_to'))
    .toEqual([{ typed: 'Genesis 99', ref: '', area: '' }]);
  expect(errors).toEqual([]);
});
