import { expect, type Page } from '@playwright/test';

/** The canvas's clear colour and the page's background: #1a1a1a. */
const BACKGROUND = 26;
/** A channel this far from the background counts as drawn. */
const DRAWN_DELTA = 12;
/** Fewer drawn pixels than this is a map that did not draw. */
export const DRAWN_FLOOR = 1000;

/**
 * Loads the map at `hash` and waits until it has drawn and settled: the story
 * applies a stop on the animation frame after startup, and the title face
 * arrives from Google Fonts with display=swap, changing text widths.
 */
export async function openMap(page: Page, hash: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(hash ? `/#${hash}` : '/');
  // Everything in the body is position: fixed, so <html> never has the
  // nonzero box waitFor's default 'visible' state requires.
  await page.locator('html[data-map-ready]').waitFor({ state: 'attached', timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await expect
    .poll(async () => (await mapPixels(page)).drawn, { timeout: 15_000 })
    .toBeGreaterThan(DRAWN_FLOOR);
  expect(errors, 'page errors').toEqual([]);
}

/**
 * Counts the map's drawn pixels and its distinct colours, from a screenshot of
 * the canvas with everything over it hidden: the labels, the title and the
 * controls carry enough text to pass for a map on their own. A screenshot is
 * what the reader sees; reading the WebGL buffer would depend on
 * preserveDrawingBuffer.
 */
export async function mapPixels(page: Page): Promise<{ drawn: number; colours: number }> {
  const hide = await page.addStyleTag({
    content: 'body *:not(#canvas) { visibility: hidden !important; }',
  });
  let png: Buffer;
  try {
    png = await page.locator('#canvas').screenshot();
  } finally {
    await hide.evaluate((el: Element) => el.remove());
  }
  return page.evaluate(
    async ({ b64, bg, delta }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let drawn = 0;
      const colours = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (Math.max(Math.abs(r - bg), Math.abs(g - bg), Math.abs(b - bg)) <= delta) continue;
        drawn++;
        colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      }
      return { drawn, colours: colours.size };
    },
    { b64: png.toString('base64'), bg: BACKGROUND, delta: DRAWN_DELTA },
  );
}
