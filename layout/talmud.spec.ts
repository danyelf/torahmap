// The Talmud page, at /talmud/ on the dev server only: it draws, its labels sit over the
// map, and a pinned segment shows its text.
import { expect, test, type Page } from '@playwright/test';
import { allLoaded, boxes, collectErrors, DRAWN_FLOOR, drawnPixels } from './page.ts';

async function openTalmud(page: Page, link = ''): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto(`/talmud/${link ? `?${link}` : ''}`);
  await allLoaded(page);
  return errors;
}

test('the Talmud map draws, with its tractate labels over it', async ({ page }) => {
  const errors = await openTalmud(page);
  await expect.poll(() => drawnPixels(page), { timeout: 15_000 }).toBeGreaterThan(DRAWN_FLOOR);
  const map = (await boxes(page, '#canvas'))[0];
  const labels = await boxes(page, '#talmud-tractate-labels > *');
  expect(labels).not.toEqual([]);
  for (const label of labels) expect(label.x).toBeGreaterThanOrEqual(map.x);
  expect(errors).toEqual([]);
});

test("a pinned segment's popup shows its text", async ({ page }) => {
  const errors = await openTalmud(page, 'verse=Berakhot.2a.1');
  await expect(page.locator('#verse-popup.visible .ref-text')).toHaveText('Berakhot 2a:1');
  await expect(page.locator('#verse-popup .verse-hebrew')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('a link to a segment that does not exist pins nothing', async ({ page }) => {
  const errors = await openTalmud(page, 'verse=Berakhot.999a.1');
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
  await expect(page.locator('#verse-popup.visible')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a tractate file that fails says so, and isn't fetched again", async ({ page }) => {
  let requests = 0;
  await page.route('**/talmud/texts/Berakhot.json', (route) => {
    requests++;
    return route.fulfill({ status: 404 });
  });
  await openTalmud(page, 'verse=Berakhot.2a.1');
  await expect(page.locator('#verse-popup .verse-notice')).not.toBeEmpty();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#verse-popup .ref-text')).toHaveText('Berakhot 2a:1');
  expect(requests).toBe(1);
});

test('/talmud, without the slash, opens the same page and keeps the link', async ({ page }) => {
  await page.goto('/talmud?verse=Berakhot.2a.1');
  await expect(page).toHaveURL(/\/talmud\/\?verse=Berakhot\.2a\.1$/);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
});
