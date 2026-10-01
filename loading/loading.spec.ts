// The map draws before its data and fills in as each file lands. Each case
// holds files back on a throttled connection, so "before the data" is a state
// the case sets rather than a race it hopes to win.
import { expect, test, type Page } from '@playwright/test';
import { viaMenu } from '../layout/app.ts';
import { allLoaded } from '../layout/page.ts';
import {
  COMMENTARY,
  DICTIONARY,
  EVERYTHING,
  LEXICON,
  PARSE,
  SEARCH_REQUIRED,
  TEXTS_FILE,
} from './files.ts';
import {
  expectPlainMap,
  fail,
  mapChangesFrom,
  open,
  param,
  recordEvents,
  sentLoadTiming,
  sentSearches,
  stillShot,
} from './page.ts';

const WORD = 'אלהים';
const overlayRow = '.map-legend-row[data-panel="overlay"]';
const searchRow = '.map-legend-row[data-panel="search"]';

test('the bare address draws the map and opens the story before any data', async ({ page }) => {
  const { release, errors } = await open(page, '', EVERYTHING);
  await expectPlainMap(page);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'story');
  await expect(page.locator('#story')).toBeVisible();
  release();
  await allLoaded(page);
  expect(errors).toEqual([]);
});

test('an overlay link draws a plain map, says it is loading, and colours in when its file lands', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'overlay=commentary', [COMMENTARY]);
  await expectPlainMap(page);
  await expect(page.locator('#overlay-select')).toHaveValue('commentary');
  await expect(page.locator(`${overlayRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(overlayRow)).toBeVisible();
  await expect(page.locator(overlayRow)).not.toHaveAttribute('data-loading');
  await allLoaded(page);
  expect(param(page, 'overlay')).toBe('commentary');
  expect(errors).toEqual([]);
});

test("a search link keeps its word in the box, and finds it once search's files land", async ({
  page,
}) => {
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent(WORD)}`,
    SEARCH_REQUIRED,
  );
  await expectPlainMap(page);
  await expect(page.locator('#search-input')).toHaveValue(WORD);
  await expect(
    page.locator('#search-hit-caption .load-notice[data-state="loading"]'),
  ).toBeAttached();
  // On a phone the panel opens closed, so the legend is the one place that says so.
  await expect(page.locator(`${searchRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(searchRow)).toBeVisible();
  await expect(page.locator(searchRow)).not.toHaveAttribute('data-loading');
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await allLoaded(page);
  expect(param(page, 'search')).toBe(WORD);
  expect(errors).toEqual([]);
});

test('the search results are quoted again when the per-word parse lands, keeping their place', async ({
  page,
}) => {
  // Genesis 19:28 has both עַל and עָלָה; only the parse tells them apart.
  const { release, errors } = await open(page, `search=${encodeURIComponent('עלה')}`, [PARSE]);
  await viaMenu(page, 'search');
  const list = page.locator('#search-results');
  const mark = list.locator('.search-result', { hasText: '19:28' }).locator('mark');
  await expect(mark).toHaveText('עַל');
  await list.evaluate((el) => (el.scrollTop = 60));
  release();
  await expect(mark).toHaveText('עָלָה');
  expect(await list.evaluate((el) => el.scrollTop)).toBe(60);
  await allLoaded(page);
  expect(errors).toEqual([]);
});

test('a narrowed search link keeps its meaning while the dictionary is on its way', async ({
  page,
}) => {
  const meaning = '<LH/@heb';
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent('עלה')}&m=${encodeURIComponent(meaning)}`,
    DICTIONARY,
  );
  expect(param(page, 'm')).toBe(meaning);
  release();
  await allLoaded(page);
  await viaMenu(page, 'search');
  await expect(page.locator('.term-row[data-open="true"] .meaning-row input:checked')).toHaveCount(
    1,
  );
  expect(param(page, 'm')).toBe(meaning);
  expect(errors).toEqual([]);
});

test('a pinned verse is centred at once, and its popup fills in when the texts land', async ({
  page,
}) => {
  const link = 'verse=Genesis.12.1';
  const { release, errors } = await open(page, link, [TEXTS_FILE]);
  await expect(
    page.locator('#verse-popup.visible .load-notice[data-state="loading"]'),
  ).toBeVisible();
  await expect(page.locator('#verse-popup .verse-word')).toHaveCount(0);

  // Centred where it is with every file in: the same plain map, the same pin.
  const settled = await page.context().newPage();
  await settled.goto(`/?${link}`);
  await allLoaded(settled);
  expect((await stillShot(page)).equals(await stillShot(settled))).toBe(true);
  await settled.close();

  release();
  await allLoaded(page);
  await expect(page.locator('#verse-popup.visible .verse-word').first()).toBeVisible();
  await expect(page.locator('#verse-popup .load-notice')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * The popup's notice on a story stop that pins a verse. On a desktop it is a
 * strip along the popup's bottom, apart from where the text goes; on a phone it
 * stands where the Hebrew goes, above the English.
 */
async function expectPopupNotice(
  page: Page,
  state: 'loading' | 'failed',
  screen: string,
): Promise<void> {
  const notice = page.locator(`#verse-popup.visible .load-notice[data-state="${state}"]`);
  await expect(notice).toBeVisible();
  await expect(page.locator('#verse-popup .verse-hebrew .load-notice')).toHaveCount(0);
  const strip = (await page.locator('#verse-popup .verse-notice').boundingBox())!;
  const popup = (await page.locator('#verse-popup').boundingBox())!;
  if (screen === 'phone') {
    const english = (await page.locator('#verse-popup .verse-english').boundingBox())!;
    expect(strip.y + strip.height).toBeLessThanOrEqual(english.y);
  } else {
    // The popup's border is 1px.
    expect(Math.abs(strip.y + strip.height - (popup.y + popup.height - 1))).toBeLessThanOrEqual(1);
    await expect(page.locator('#verse-popup .verse-hebrew')).toBeHidden();
    await expect(page.locator('#verse-popup .verse-english')).toBeHidden();
  }
}

test("a story stop's verse says its text is loading apart from the text", async ({
  page,
}, info) => {
  const { release, errors } = await open(page, 'story=tour&stop=verses', [TEXTS_FILE]);
  await expectPopupNotice(page, 'loading', info.project.name);
  release();
  await allLoaded(page);
  await expect(page.locator('#verse-popup.visible .verse-word').first()).toBeVisible();
  await expect(page.locator('#verse-popup .verse-notice')).toBeHidden();
  expect(errors).toEqual([]);
});

test("a story stop's verse says its text failed apart from the text", async ({ page }, info) => {
  await fail(page, [TEXTS_FILE]);
  const { errors } = await open(page, 'story=tour&stop=verses', [], {
    console: false,
    until: 'loaded',
  });
  await expectPopupNotice(page, 'failed', info.project.name);
  await page.locator('#verse-popup .load-notice-close').click();
  await expect(page.locator('#verse-popup .load-notice')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an overlay picked before its file lands colours in when it does', async ({ page }) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', [COMMENTARY]);
  await page.keyboard.press('Escape');
  await viaMenu(page, 'overlay');
  await page.locator('#overlay-select').selectOption('commentary');
  await expectPlainMap(page);
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator('#overlay-select')).toHaveValue('commentary');
  await allLoaded(page);
  expect(param(page, 'overlay')).toBe('commentary');
  expect(errors).toEqual([]);
});

test('a search typed before its files land keeps the box and finds the word when they do', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_REQUIRED);
  await page.keyboard.press('Escape');
  await viaMenu(page, 'search');
  const box = page.locator('#search-input');
  await box.fill('light');
  await expect(box).toBeFocused();
  await expectPlainMap(page);
  release();
  await expect.poll(() => page.locator('.search-result').count()).toBeGreaterThan(0);
  await expect(box).toHaveValue('light');
  await expect(box).toBeFocused();
  await allLoaded(page);
  expect(param(page, 'search')).toBe('light');
  expect(errors).toEqual([]);
});

test('a story scrolled to a search before its files land shows the search when they do', async ({
  page,
}) => {
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_REQUIRED);
  await page.locator('.story-stop[data-stop-id="abraham_zoom"]').scrollIntoViewIfNeeded();
  await expect.poll(() => param(page, 'stop')).toBe('abraham_zoom');
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(searchRow)).toBeVisible();
  await expect(page.locator(searchRow)).not.toHaveAttribute('data-loading');
  await allLoaded(page);
  expect(errors).toEqual([]);
});

test('an overlay and a search fill in each as its own files land', async ({ page }) => {
  const { release, errors } = await open(
    page,
    `search=${encodeURIComponent(WORD)}&overlay=commentary`,
    [COMMENTARY],
  );
  // Search in first, so the change after release can only be the overlay's.
  await expect(page.locator(searchRow)).toBeVisible();
  await expect(page.locator(searchRow)).not.toHaveAttribute('data-loading');
  await expect(page.locator(`${overlayRow}[data-loading]`)).toBeVisible();
  const before = await stillShot(page);
  release();
  await mapChangesFrom(page, before);
  await expect(page.locator(overlayRow)).toBeVisible();
  await expect(page.locator(overlayRow)).not.toHaveAttribute('data-loading');
  await allLoaded(page);
  expect(errors).toEqual([]);
});

test('a failed download leaves its overlay plain and says so where it would show', async ({
  page,
}) => {
  await fail(page, [COMMENTARY]);
  // The browser and the app both log the failed download; only uncaught errors count here.
  const { errors } = await open(page, 'overlay=commentary', [], {
    console: false,
    until: 'loaded',
  });
  await expectPlainMap(page);
  const warning = page.locator('#map-legend .load-notice[data-state="failed"]');
  await expect(warning).toBeVisible();
  await warning.locator('.load-notice-close').click();
  await expect(warning).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a search typed before its files land is recorded once they do', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'what is recorded does not depend on the screen');
  const { release, errors } = await open(page, 'overlay=haftarah', SEARCH_REQUIRED);
  await recordEvents(page);
  await viaMenu(page, 'search');
  await page.locator('#search-input').fill('light');
  release();
  await expect.poll(() => sentSearches(page)).toEqual(['light']);
  await allLoaded(page);
  expect(await sentSearches(page)).toEqual(['light']);
  expect(errors).toEqual([]);
});

test('a linked search is never recorded; a word the reader adds is', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'what is recorded does not depend on the screen');
  const { release, errors } = await open(page, 'search=light', SEARCH_REQUIRED);
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

test('a lexicon search cannot build from fails its prebuild alone, and the rest still load', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'what loads does not depend on the screen');
  const parseLanded = page.waitForResponse(`**/data/${PARSE}`, { timeout: 120_000 });
  // A lexicon with no lexemes: building the dictionary from it throws.
  const { release, errors } = await open(page, 'overlay=haftarah', [LEXICON], { body: '{}' });
  await recordEvents(page);
  release();
  await allLoaded(page);
  // The per-word parse is the last stage.
  expect((await parseLanded).ok()).toBe(true);
  await expect.poll(() => sentLoadTiming(page)).toHaveLength(1);
  expect((await sentLoadTiming(page))[0].search_ready).toBe(0);
  // With no search typed, nothing builds the dictionary as the lexicon lands:
  // only search's idle prebuild does, and it throws uncaught, by design.
  await expect.poll(() => errors.length).toBe(1);
  expect(errors[0]).not.toMatch(/^console:/);
  expect(errors[0]).toContain('buildDictionary');
});

test('the capture shortcut keeps an overlay whose file has not landed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a keyboard shortcut for authors');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
  const { errors } = await open(page, 'overlay=commentary', [COMMENTARY]);
  await page.keyboard.press('Control+Shift+C');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { copied?: string }).copied))
    .toContain('commentary');
  expect(errors).toEqual([]);
});
