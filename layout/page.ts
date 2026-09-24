import { expect, type Page } from '@playwright/test';
import type { Box } from './geometry.ts';

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

/**
 * The visible part of every element matching `selector`. An element inside a
 * collapsed or scrolled container still has its full bounding rect, so each is
 * cut to the ancestors that clip it. The walk stops at <body>, whose overflow
 * the browser hands to the viewport, and after the first fixed-position box,
 * since nothing above a fixed box clips it.
 */
export async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      if (el.closest('[inert]')) return [];
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      for (let a: Element | null = el; a; a = a.parentElement) {
        if (getComputedStyle(a).opacity === '0') return [];
      }
      let { left, top, right, bottom } = el.getBoundingClientRect();
      if (style.position !== 'fixed') {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
            const r = a.getBoundingClientRect();
            left = Math.max(left, r.left);
            top = Math.max(top, r.top);
            right = Math.min(right, r.right);
            bottom = Math.min(bottom, r.bottom);
          }
          if (s.position === 'fixed') break;
        }
      }
      if (right - left < 1 || bottom - top < 1) return [];
      const name = el.id
        ? `#${el.id}`
        : el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
      return [{ name, x: left, y: top, width: right - left, height: bottom - top }];
    }),
  );
}

/**
 * Elements whose text does not fit their box. A block is measured by its
 * scroll width; an inline element has none, so its text is measured against
 * its parent's box instead. Anything a pixel or less across is hidden for
 * screen readers on purpose, and skipped, as is an element that clips its
 * overflow with `text-overflow: ellipsis`: that is a summary truncated on
 * purpose, not a layout defect. (`text-overflow` alone does nothing on an
 * element whose overflow is still `visible`.)
 */
export async function clippedText(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      const h = el as HTMLElement;
      if (h.closest('[inert]') || !h.textContent?.trim()) return [];
      const style = getComputedStyle(h);
      if (style.textOverflow === 'ellipsis' && style.overflowX !== 'visible') return [];
      const box = h.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return [];
      const name = h.id ? `#${h.id}` : `${h.tagName.toLowerCase()}.${[...h.classList].join('.')}`;
      if (style.display === 'inline') {
        const range = document.createRange();
        range.selectNodeContents(h);
        const text = range.getBoundingClientRect();
        const parent = h.parentElement!.getBoundingClientRect();
        return text.left < parent.left - 1 || text.right > parent.right + 1
          ? [`${name} runs ${Math.round(text.right - parent.right)}px past its parent`]
          : [];
      }
      return h.scrollWidth > h.clientWidth + 1
        ? [`${name} needs ${h.scrollWidth}px, has ${h.clientWidth}`]
        : [];
    }),
  );
}
