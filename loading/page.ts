// What the loading cases share beyond layout/page.ts: a connection that holds
// files back until the case lets them through, and what the map and the app's
// analytics show meanwhile.
import { expect, type Page } from '@playwright/test';
import { canvasShot, collectErrors, DRAWN_FLOOR, firstFrame, pixelCounts } from '../layout/page.ts';

/** The plain map is grey; a few coloured pixels still count as plain. */
const COLOURED_FLOOR = 100;

/**
 * A slow phone, for the dev server: it sends files uncompressed, about four
 * times the bytes the site sends, so this is four times a 4 Mbit/s connection.
 */
const SLOW_MOBILE = {
  offline: false,
  latency: 150,
  downloadThroughput: 2_000_000,
  uploadThroughput: 375_000,
};

export async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_MOBILE);
}

/** Keeps each data file in `paths` from arriving until the returned function is called. */
export async function hold(page: Page, paths: readonly string[]): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  for (const path of paths) {
    await page.route(`**/data/${path}`, async (route) => {
      await released;
      // The page may have closed while the file was held.
      await route.continue().catch(() => {});
    });
  }
  return release;
}

/** Makes each data file in `paths` fail to download. */
export async function fail(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) await page.route(`**/data/${path}`, (route) => route.abort());
}

/**
 * Opens `link` on the throttled connection with the files in `held` kept back,
 * and waits for the first frame.
 */
export async function open(
  page: Page,
  link: string,
  held: readonly string[],
): Promise<{ release: () => void; errors: string[] }> {
  await throttle(page);
  const release = await hold(page, held);
  const errors = collectErrors(page);
  await page.goto(link ? `/?${link}` : '/');
  await firstFrame(page, 90_000);
  return { release, errors };
}

/** The map has drawn, and nothing on it is coloured. */
export async function expectPlainMap(page: Page): Promise<void> {
  await expect
    .poll(async () => (await pixelCounts(page, await canvasShot(page))).drawn)
    .toBeGreaterThan(DRAWN_FLOOR);
  expect((await pixelCounts(page, await canvasShot(page))).coloured).toBeLessThan(COLOURED_FLOOR);
}

/** The canvas once two shots in a row agree: an ease or a glide in progress has finished. */
export async function stillShot(page: Page): Promise<Buffer> {
  let last = await canvasShot(page);
  for (;;) {
    await page.waitForTimeout(250);
    const next = await canvasShot(page);
    if (next.equals(last)) return next;
    last = next;
  }
}

/** Waits until the canvas differs from `before`. */
export async function mapChangesFrom(page: Page, before: Buffer): Promise<void> {
  await expect.poll(async () => (await canvasShot(page)).equals(before)).toBe(false);
}

export function param(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

/**
 * Turns on the app's analytics, which the dev server leaves off, sending each
 * event to window.sent. The module script imports the app's own module: the
 * browser loads a URL once.
 */
export async function recordEvents(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { configureAnalytics } from '/src/analytics.ts';
      window.sent = [];
      configureAnalytics({ enabled: true, send: (body) => window.sent.push(JSON.parse(body)) });
    `,
  });
  await page.waitForFunction(() => 'sent' in window);
}

interface Sent {
  event: string;
  fields: Record<string, unknown>;
}

/** The term of every search recorded so far, in order. */
export async function sentSearches(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    ((window as unknown as { sent?: Sent[] }).sent ?? [])
      .filter((e) => e.event === 'search_execute')
      .map((e) => e.fields.term),
  );
}
