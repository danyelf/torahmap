// What both browser suites share: opening the map, waiting on it, reading its
// pixels and recording what it sends.
import { expect, test, type Page } from '@playwright/test';

/** The canvas's clear colour and the page's background: #1a1a1a. */
const BACKGROUND = 26;
/** A channel this far from the background counts as drawn. */
const DRAWN_DELTA = 12;
/** Fewer drawn pixels than this is a map that did not draw. */
export const DRAWN_FLOOR = 1000;

/** A pixel whose channels spread this far apart is coloured rather than grey. */
export const COLOURED_SPREAD = 24;

/** Waits for the first frame: the map drawn before any file but the structure. */
export async function firstFrame(page: Page, timeout = 30_000): Promise<void> {
  // Everything in the body is position: fixed, so <html> never has the
  // nonzero box waitFor's default 'visible' state requires.
  await page.locator('html[data-first-frame]').waitFor({ state: 'attached', timeout });
}

/**
 * Waits until every file has landed or failed and been drawn, and the map has
 * settled: the story applies a stop on the animation frame after startup, and
 * the title face arrives from Google Fonts with display=swap, changing text
 * widths.
 */
export async function allLoaded(page: Page): Promise<void> {
  await page.locator('html[data-loaded]').waitFor({ state: 'attached', timeout: 60_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/**
 * The page's uncaught errors, each with its stack, and, unless `console` is
 * false, its console errors (prefixed `console:`) from now on. They keep
 * arriving, so check the list again after acting on the page.
 */
export function collectErrors(page: Page, { console = true } = {}): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
  if (console) {
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
  }
  return errors;
}

/** Skips every screen but `screens`, saying why. */
export function onlyOn(screens: readonly string[], reason: string): void {
  test.skip(!screens.includes(test.info().project.name), reason);
}

export const desktopOnly = (reason: string) => onlyOn(['desktop'], reason);

/** Loads the map at `link` on the page at `path` and waits until it has settled and drawn. Returns `collectErrors`'s list. */
export async function openMap(page: Page, link: string, path = '/'): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto(link ? `${path}?${link}` : path);
  await allLoaded(page);
  await expect
    .poll(async () => drawnPixels(page), { timeout: 15_000 })
    .toBeGreaterThan(DRAWN_FLOOR);
  expect(errors, 'page errors').toEqual([]);
  return errors;
}

/**
 * The map as the reader sees it, with everything over it hidden: the labels,
 * the title and the controls carry enough text to pass for a map on their own.
 * A screenshot rather than the WebGL buffer, which would depend on
 * preserveDrawingBuffer.
 */
export async function canvasShot(page: Page): Promise<Buffer> {
  // Hiding the focused element blurs it, so focus is handed back after.
  const focused = await page.evaluateHandle(() => document.activeElement);
  const hide = await page.addStyleTag({
    content: 'body *:not(#canvas) { visibility: hidden !important; }',
  });
  try {
    return await page.locator('#canvas').screenshot();
  } finally {
    await hide.evaluate((el: Element) => el.remove());
    await focused.evaluate((el) => (el as HTMLElement | null)?.focus({ preventScroll: true }));
    await focused.dispose();
  }
}

/**
 * `png`'s pixels, row by row: whether each is drawn, and how far apart its
 * channels spread, 0 for grey.
 */
export async function readPixels(
  page: Page,
  png: Buffer,
): Promise<{ width: number; height: number; drawn: Buffer; spread: Buffer }> {
  const { width, height, drawn, spread } = await page.evaluate(
    async ({ png, bg, delta }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let drawn = '';
      let spread = '';
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const d = Math.max(Math.abs(r - bg), Math.abs(g - bg), Math.abs(b - bg)) > delta;
        drawn += String.fromCharCode(d ? 1 : 0);
        spread += String.fromCharCode(Math.max(r, g, b) - Math.min(r, g, b));
      }
      return { width: c.width, height: c.height, drawn: btoa(drawn), spread: btoa(spread) };
    },
    { png: png.toString('base64'), bg: BACKGROUND, delta: DRAWN_DELTA },
  );
  return {
    width,
    height,
    drawn: Buffer.from(drawn, 'base64'),
    spread: Buffer.from(spread, 'base64'),
  };
}

/** How many of `png`'s pixels are drawn, and how many are coloured rather than grey. */
export async function pixelCounts(
  page: Page,
  png: Buffer,
): Promise<{ drawn: number; coloured: number }> {
  const { drawn, spread } = await readPixels(page, png);
  return {
    drawn: drawn.filter((d) => d).length,
    coloured: spread.filter((s) => s > COLOURED_SPREAD).length,
  };
}

/** Counts the map's drawn pixels. */
export async function drawnPixels(page: Page): Promise<number> {
  return (await pixelCounts(page, await canvasShot(page))).drawn;
}

export function param(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

/**
 * Keeps each data file in `paths` from arriving until the returned function is
 * called, then sends it, or `body` in its place if given.
 */
export async function hold(
  page: Page,
  paths: readonly string[],
  body?: string,
): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  for (const path of paths) {
    await page.route(`**/data/${path}`, async (route) => {
      await released;
      // The page may have closed while the file was held.
      await (
        body === undefined
          ? route.continue()
          : route.fulfill({ contentType: 'application/json', body })
      ).catch(() => {});
    });
  }
  return release;
}

const sent = new WeakMap<Page, Sent[]>();

/**
 * Starts recording the events the app sends from now on: the beacon requests the built page
 * makes to /api/event.
 */
export async function recordEvents(page: Page): Promise<void> {
  const events: Sent[] = [];
  sent.set(page, events);
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/event')
      events.push(JSON.parse(request.postData() ?? '{}'));
  });
}

interface Sent {
  event: string;
  fields: Record<string, unknown>;
}

/** The fields of every `event` sent so far, in order. */
export async function sentFields(page: Page, event: string): Promise<Record<string, unknown>[]> {
  return (sent.get(page) ?? []).filter((e) => e.event === event).map((e) => e.fields);
}

/** The term of every search recorded so far, in order. */
export async function sentSearches(page: Page): Promise<unknown[]> {
  return (await sentFields(page, 'search_execute')).map((fields) => fields.term);
}

/** Opens a menu item through the ☰. */
export async function viaMenu(page: Page, action: string): Promise<void> {
  await page.locator('#menu-toggle').click();
  await page.locator(`.menu-item[data-action="${action}"]:visible`).click();
}
