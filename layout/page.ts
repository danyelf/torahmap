import { expect, type Page } from '@playwright/test';
import type { Box, Shown } from './geometry.ts';
import { VISITED_KEY } from '../src/visits.ts';

/** The canvas's clear colour and the page's background: #1a1a1a. */
const BACKGROUND = 26;
/** A channel this far from the background counts as drawn. */
const DRAWN_DELTA = 12;
/** Fewer drawn pixels than this is a map that did not draw. */
export const DRAWN_FLOOR = 1000;

/** A pixel whose channels spread this far apart is coloured rather than grey. */
const COLOURED_SPREAD = 24;

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

/** Makes the next load a return visit, so an empty link skips the story. */
export async function asReturningReader(page: Page): Promise<void> {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), VISITED_KEY);
}

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

/** How many of `png`'s pixels are drawn, and how many of those are coloured rather than grey. */
export async function pixelCounts(
  page: Page,
  png: Buffer,
): Promise<{ drawn: number; coloured: number }> {
  return page.evaluate(
    async ({ b64, bg, delta, spread }) => {
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
      let coloured = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (Math.max(Math.abs(r - bg), Math.abs(g - bg), Math.abs(b - bg)) > delta) drawn++;
        if (Math.max(r, g, b) - Math.min(r, g, b) > spread) coloured++;
      }
      return { drawn, coloured };
    },
    { b64: png.toString('base64'), bg: BACKGROUND, delta: DRAWN_DELTA, spread: COLOURED_SPREAD },
  );
}

/** Counts the map's drawn pixels. */
export async function drawnPixels(page: Page): Promise<number> {
  return (await pixelCounts(page, await canvasShot(page))).drawn;
}

/**
 * Every element matching `selector`, with its full box and the part of it that
 * shows. An element inside a collapsed or scrolled container still has its full
 * bounding rect, so each is cut to the ancestors that clip it. The walk stops
 * at <body>, whose overflow the browser hands to the viewport, and after the
 * first fixed-position box, since nothing above a fixed box clips it.
 */
export async function shown(page: Page, selector: string): Promise<Shown[]> {
  return page.$$eval(selector, (els) =>
    els.map((el) => {
      const r0 = el.getBoundingClientRect();
      const name = el.id
        ? `#${el.id}`
        : el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
      const full = { name, x: r0.left, y: r0.top, width: r0.width, height: r0.height };
      const hidden = { full, visible: null };
      if (el.closest('[inert]')) return hidden;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return hidden;
      for (let a: Element | null = el; a; a = a.parentElement) {
        if (getComputedStyle(a).opacity === '0') return hidden;
      }
      let { left, top, right, bottom } = r0;
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
      if (right - left < 1 || bottom - top < 1) return hidden;
      return { full, visible: { x: left, y: top, width: right - left, height: bottom - top } };
    }),
  );
}

/** The visible part of every element matching `selector` that shows at all. */
export async function boxes(page: Page, selector: string): Promise<Box[]> {
  return (await shown(page, selector)).flatMap(({ full, visible }) =>
    visible ? [{ name: full.name, ...visible }] : [],
  );
}

/**
 * Elements whose text does not fit their box. A block is measured by its
 * scroll width, and by its scroll height when it clips vertically; an inline
 * element has neither, so its text is measured across against its parent's
 * full box instead, which misses a parent that is itself cut off. Anything a
 * pixel or less across is hidden for screen readers on purpose, and skipped.
 * Text cut short across with `text-overflow: ellipsis` is a summary truncated
 * on purpose, not a layout defect. (`text-overflow` alone does nothing on an
 * element whose overflow is still `visible`.)
 */
export async function clippedText(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((el) => {
      const h = el as HTMLElement;
      if (h.closest('[inert]') || !h.textContent?.trim()) return [];
      const style = getComputedStyle(h);
      const ellipsis = style.textOverflow === 'ellipsis' && style.overflowX !== 'visible';
      const box = h.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return [];
      const name = h.id
        ? `#${h.id}`
        : h.tagName.toLowerCase() + [...h.classList].map((c) => `.${c}`).join('');
      if (style.display === 'inline') {
        const range = document.createRange();
        range.selectNodeContents(h);
        const text = range.getBoundingClientRect();
        const parent = h.parentElement!.getBoundingClientRect();
        return text.left < parent.left - 1 || text.right > parent.right + 1
          ? [`${name} runs ${Math.round(text.right - parent.right)}px past its parent`]
          : [];
      }
      const out: string[] = [];
      if (!ellipsis && h.scrollWidth > h.clientWidth + 1) {
        out.push(`${name} needs ${h.scrollWidth}px, has ${h.clientWidth}`);
      }
      if (style.overflowY !== 'visible' && h.scrollHeight > h.clientHeight + 1) {
        out.push(`${name} needs ${h.scrollHeight}px high, has ${h.clientHeight}`);
      }
      return out;
    }),
  );
}
