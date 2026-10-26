// What the loading cases share beyond test/browser/page.ts: opening the map on a slow
// connection with files held back, and reading the map.
import { expect, type Page } from '@playwright/test';
import {
  allLoaded,
  hold,
  sentFields,
  canvasShot,
  collectErrors,
  DRAWN_FLOOR,
  firstFrame,
  pixelCounts,
} from '../browser/page.ts';

/** The plain map is grey; a few coloured pixels still count as plain. */
const COLOURED_FLOOR = 100;

/**
 * A slow phone: the suite's server sends files uncompressed, about four times
 * the bytes the site sends, so this is four times a 4 Mbit/s connection. Only
 * the data files cross it.
 */
const SLOW_MOBILE_DATA = {
  urlPattern: '*://*:*/data/*',
  latency: 150,
  downloadThroughput: 2_000_000,
  uploadThroughput: 375_000,
};

export async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditionsByRule', {
    offline: false,
    matchedNetworkConditions: [SLOW_MOBILE_DATA],
  });
}

/** Makes each data file in `paths` fail to download. */
export async function fail(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) await page.route(`**/data/${path}`, (route) => route.abort());
}

/**
 * Opens `link` on the throttled connection with the files in `held` kept back
 * (and sent as `body`, if given), and waits for the first frame, or with
 * `until: 'loaded'` for every file. `errors` is collectErrors's list, with
 * console errors unless `console` is false.
 */
export async function open(
  page: Page,
  link: string,
  held: readonly string[],
  {
    console = true,
    until = 'firstFrame',
    body,
  }: { console?: boolean; until?: 'firstFrame' | 'loaded'; body?: string } = {},
): Promise<{ release: () => void; errors: string[] }> {
  await throttle(page);
  const release = await hold(page, held, body);
  const errors = collectErrors(page, { console });
  await page.goto(link ? `/?${link}` : '/');
  if (until === 'loaded') await allLoaded(page);
  else await firstFrame(page, 90_000);
  return { release, errors };
}

/** The map has drawn, and nothing on it is coloured. */
export async function expectPlainMap(page: Page): Promise<void> {
  let counts = { drawn: 0, coloured: 0 };
  await expect
    .poll(async () => (counts = await pixelCounts(page, await canvasShot(page))).drawn)
    .toBeGreaterThan(DRAWN_FLOOR);
  expect(counts.coloured).toBeLessThan(COLOURED_FLOOR);
}

/** The canvas once two shots in a row agree: an ease or a glide in progress has finished. */
export async function stillShot(page: Page, timeout = 30_000): Promise<Buffer> {
  const deadline = Date.now() + timeout;
  let last = await canvasShot(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const next = await canvasShot(page);
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error(`the map never settled: still changing after ${timeout} ms`);
}

/** Waits until the canvas differs from `before`. */
export async function mapChangesFrom(page: Page, before: Buffer): Promise<void> {
  await expect.poll(async () => (await canvasShot(page)).equals(before)).toBe(false);
}

export const sentLoadTiming = (page: Page) => sentFields(page, 'load_timing');
