// What the Talmud's page downloads and when, and what it says when a file fails.
import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import {
  allLoaded,
  canvasShot,
  DRAWN_FLOOR,
  firstFrame,
  hold,
  openMap,
  pixelCounts,
  viaMenu,
} from '../browser/page.ts';
import { englishFile, SEARCH_ENGLISH_FILE, SEARCH_FILE, textsFile } from '@torahmap/talmud/data.ts';
import { TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { fail, requestsFor } from './page.ts';

test("the Talmud's English downloads only once English is shown, and its Hebrew does not wait for it", async ({
  page,
}) => {
  const english = requestsFor(page, englishFile('Berakhot'));
  await page.addInitScript(() => localStorage.setItem('torahMap.languages', 'he'));
  const release = await hold(page, [englishFile('Berakhot')]);
  await page.goto(`${TALMUD_PATH}?at=Berakhot.2a.1`);
  await allLoaded(page);
  await expect(page.locator('#popup.visible .popup-hebrew')).not.toBeEmpty();
  expect(english).toEqual([]);

  await viaMenu(page, 'about');
  await page.locator('#language-choice [data-languages="both"]').click();
  await expect.poll(() => english.length).toBe(1);
  await expect(page.locator('#popup .popup-hebrew')).toBeVisible();
  await expect(
    page.locator('#popup .popup-notice[data-language="en"] .load-notice[data-state="loading"]'),
  ).toBeVisible();
  await expect(page.locator('#popup .popup-english')).toBeHidden();
  release();
  await expect(page.locator('#popup .popup-english')).not.toBeEmpty();
  await expect(page.locator('#popup .load-notice')).toHaveCount(0);
});

test("the Talmud's English alone downloads no Hebrew, and a failed English says so in its place", async ({
  page,
}) => {
  const hebrew = requestsFor(page, textsFile('Berakhot'));
  await page.addInitScript(() => localStorage.setItem('torahMap.languages', 'en'));
  await fail(page, [englishFile('Berakhot')]);
  await page.goto(`${TALMUD_PATH}?at=Berakhot.2a.1`);
  await allLoaded(page);
  await expect(
    page.locator(
      '#popup.visible .popup-notice[data-language="en"] .load-notice[data-state="failed"]',
    ),
  ).toBeVisible();
  expect(hebrew).toEqual([]);

  await viaMenu(page, 'about');
  await page.locator('#language-choice [data-languages="both"]').click();
  await expect(page.locator('#popup .popup-hebrew')).not.toBeEmpty();
  await expect(page.locator('#popup .popup-notice[data-language="en"] .load-notice')).toBeVisible();
});

test("the Talmud's English search downloads once after the rest, though nothing searches English", async ({
  page,
}) => {
  const english = requestsFor(page, SEARCH_ENGLISH_FILE);
  await page.goto(TALMUD_PATH);
  await allLoaded(page);
  expect(english).toHaveLength(1);
});

test("an English term fetches the Talmud's English search at once, once, and finds it", async ({
  page,
}) => {
  const english = requestsFor(page, SEARCH_ENGLISH_FILE);
  // Held, the Hebrew keeps the downloads from reaching the English in their turn.
  const release = await hold(page, [SEARCH_FILE]);
  await page.goto(`${TALMUD_PATH}?search=${encodeURIComponent('רבי')}`);
  await firstFrame(page, 90_000);
  await viaMenu(page, 'search');
  await page.locator('#search-input').fill('rabbi');
  await expect.poll(() => english.length).toBe(1);
  release();
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await allLoaded(page);
  expect(english).toHaveLength(1);
});

test("a link with an English term fetches the Talmud's English search with the opening view", async ({
  page,
}) => {
  const english = requestsFor(page, SEARCH_ENGLISH_FILE);
  const release = await hold(page, [SEARCH_FILE]);
  await page.goto(`${TALMUD_PATH}?search=rabbi`);
  await firstFrame(page, 90_000);
  await expect.poll(() => english.length).toBe(1);
  release();
  await allLoaded(page);
  expect(english).toHaveLength(1);
});

test('a failed English search file says so for an English term, and Hebrew search still finds', async ({
  page,
}) => {
  await fail(page, [SEARCH_ENGLISH_FILE]);
  await page.goto(`${TALMUD_PATH}?search=rabbi`);
  await allLoaded(page);
  await viaMenu(page, 'search');
  await expect(page.locator('#search-hit-caption .load-notice[data-state="failed"]')).toBeVisible();
  await page.locator('#search-input').fill('רבי');
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await expect(page.locator('#search-hit-caption .load-notice')).toHaveCount(0);
});

test("a tractate file that fails says so, and isn't fetched again", async ({ page }) => {
  let requests = 0;
  await page.route(`**/data/${textsFile('Berakhot')}`, (route) => {
    requests++;
    return route.fulfill({ status: 404 });
  });
  // Not openMap: the failed download is reported, as a console error.
  await page.goto(`${TALMUD_PATH}?at=Berakhot.2a.1`);
  await allLoaded(page);
  await expect(page.locator('#popup .popup-notice[data-language="he"]')).not.toBeEmpty();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#popup .ref-text')).toHaveText('Berakhot 2a:1');
  expect(requests).toBe(1);
});

test("a link's search reaches the Talmud's own search, not the Tanakh's", async ({ page }) => {
  const searchFiles: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/search/')) searchFiles.push(request.url());
  });
  await openMap(page, 'search=משנה', TALMUD_PATH);
  await expect(page.locator('#search-input')).toHaveValue('משנה');
  expect(searchFiles).toEqual([]);
});

// What the map draws, on the real map.
test.describe('the drawn map', () => {
  test.use({ realMap: true });

  test('a returning reader on the bare address gets the map in its colours, not a plain grey', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('torahMap.visited', 'true'));
    await page.goto(TALMUD_PATH);
    await allLoaded(page);
    // The Talmud's tan and violet count as coloured; the plain grey does not.
    await expect
      .poll(async () => (await pixelCounts(page, await canvasShot(page))).coloured)
      .toBeGreaterThan(DRAWN_FLOOR);
  });
});
