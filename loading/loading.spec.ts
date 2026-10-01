// The map draws before its data and fills in as each file lands. Each case
// holds files back on a throttled connection, so "before the data" is a state
// the case sets rather than a race it hopes to win.
import { expect, test } from '@playwright/test';
import { viaMenu } from '../layout/app.ts';
import { allLoaded, firstFrame } from '../layout/page.ts';
import { COMMENTARY, DICTIONARY, EVERYTHING, LEXICON, PARSE, TEXTS_FILE } from './files.ts';
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
  throttle,
} from './page.ts';

const WORD = 'אלהים';
const SEARCH_FILES_HELD = [TEXTS_FILE, ...DICTIONARY];
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
    SEARCH_FILES_HELD,
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
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_FILES_HELD);
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
  const { release, errors } = await open(page, 'story=tour&stop=intro', SEARCH_FILES_HELD);
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
  const { release, errors } = await open(page, 'overlay=haftarah', SEARCH_FILES_HELD);
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
  const { release, errors } = await open(page, 'search=light', SEARCH_FILES_HELD);
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
  await throttle(page);
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  // A lexicon with no lexemes: building the dictionary from it throws.
  await page.route(`**/data/${LEXICON}`, async (route) => {
    await released;
    await route.fulfill({ contentType: 'application/json', body: '{}' }).catch(() => {});
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.stack ?? e.message));
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  const parseLanded = page.waitForResponse(`**/data/${PARSE}`, { timeout: 120_000 });
  await page.goto('/?overlay=haftarah');
  await firstFrame(page, 90_000);
  await recordEvents(page);
  release();
  await allLoaded(page);
  // The per-word parse is the last stage.
  expect((await parseLanded).ok()).toBe(true);
  await expect.poll(() => sentLoadTiming(page)).toHaveLength(1);
  expect((await sentLoadTiming(page))[0].search_ready).toBe(0);
  // With no search typed, nothing builds the dictionary as the lexicon lands:
  // only search's idle prebuild does, and it throws uncaught, by design.
  await expect.poll(() => pageErrors.length).toBe(1);
  expect(pageErrors[0]).toContain('buildDictionary');
  expect(consoleErrors).toEqual([]);
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
