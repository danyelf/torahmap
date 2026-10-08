// The Talmud page, at /talmud/ on the dev server only: it draws, its labels sit over the
// map, and a pinned segment shows its text.
import { expect, test } from '@playwright/test';
import { allLoaded, boxes, openMap } from './page.ts';

const TALMUD = '/talmud/';

test('the Talmud map draws, with its tractate labels over it', async ({ page }) => {
  await openMap(page, '', TALMUD);
  const map = (await boxes(page, '#canvas'))[0];
  const labels = await boxes(page, '#talmud-tractate-labels > *');
  expect(labels).not.toEqual([]);
  for (const label of labels) expect(label.x).toBeGreaterThanOrEqual(map.x);
});

test("a pinned segment's popup shows its text", async ({ page }) => {
  const errors = await openMap(page, 'at=Berakhot.2a.1', TALMUD);
  await expect(page.locator('#verse-popup.visible .ref-text')).toHaveText('Berakhot 2a:1');
  await expect(page.locator('#verse-popup .verse-hebrew')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('a link to a segment that does not exist pins nothing', async ({ page }) => {
  await openMap(page, 'at=Berakhot.999a.1', TALMUD);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
  await expect(page.locator('#verse-popup.visible')).toHaveCount(0);
});

test("a tractate file that fails says so, and isn't fetched again", async ({ page }) => {
  let requests = 0;
  await page.route('**/talmud/texts/Berakhot.json', (route) => {
    requests++;
    return route.fulfill({ status: 404 });
  });
  // Not openMap: the failed download is reported, as a console error.
  await page.goto(`${TALMUD}?at=Berakhot.2a.1`);
  await allLoaded(page);
  await expect(page.locator('#verse-popup .verse-notice')).not.toBeEmpty();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#verse-popup .ref-text')).toHaveText('Berakhot 2a:1');
  expect(requests).toBe(1);
});

test("a link's search reaches the Talmud's own search, not the Tanakh's", async ({ page }) => {
  const searchFiles: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/search/')) searchFiles.push(request.url());
  });
  await openMap(page, 'search=משנה', TALMUD);
  await expect(page.locator('#search-input')).toHaveValue('משנה');
  expect(searchFiles).toEqual([]);
});

test('/talmud, without the slash, opens the same page and keeps the link', async ({ page }) => {
  await page.goto('/talmud?at=Berakhot.2a.1');
  await expect(page).toHaveURL(/\/talmud\/\?at=Berakhot\.2a\.1$/);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
});
