import { expect, type Page, type TestInfo } from '@playwright/test';
import { SCREENSHOTS } from '../browser/fakeMap.ts';
import type { Box, Shown } from './geometry.ts';
import { DESKTOP_AND_PHONE, DESKTOP_TABLET_AND_PHONE } from '../browser/screens.ts';
import { VISITED_KEY } from '../../packages/shell/src/visits.ts';
import { COLOURED_SPREAD, onlyOn, readPixels } from '../browser/page.ts';

export const desktopAndPhoneOnly = () =>
  onlyOn(DESKTOP_AND_PHONE, 'one screen of each layout is enough');

export const desktopTabletAndPhoneOnly = () =>
  onlyOn(DESKTOP_TABLET_AND_PHONE, 'one screen of each layout, and the desktop layout by touch');

/** Makes the next load a return visit, so an empty link skips the story. */
export async function asReturningReader(page: Page): Promise<void> {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), VISITED_KEY);
}

/** Of `png`'s coloured pixels, the share that are faint: a colour under half strength. */
export async function faintShare(page: Page, png: Buffer): Promise<number> {
  const { spread } = await readPixels(page, png);
  const coloured = spread.filter((s) => s > COLOURED_SPREAD);
  const strongest = Math.max(0, ...coloured);
  return coloured.length ? coloured.filter((s) => s < strongest / 2).length / coloured.length : 0;
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

/**
 * How often a drawn line steps up or down a pixel: the share of drawn pixels
 * whose right-hand neighbour is empty while the one above or below it is drawn.
 */
export async function stepShare(page: Page, png: Buffer): Promise<number> {
  const { width, height, drawn: mask } = await readPixels(page, png);
  const drawn = (x: number, y: number) => mask[y * width + x] === 1;
  let total = 0;
  let steps = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      if (!drawn(x, y)) continue;
      total++;
      if (!drawn(x + 1, y) && (drawn(x + 1, y - 1) || drawn(x + 1, y + 1))) steps++;
    }
  }
  return total ? steps / total : 0;
}

/** The longest unbroken run of drawn pixels along any one row of `png`. */
export async function longestDrawnRun(page: Page, png: Buffer): Promise<number> {
  const { width, drawn } = await readPixels(page, png);
  let longest = 0;
  let run = 0;
  drawn.forEach((d, i) => {
    if (i % width === 0) run = 0;
    run = d ? run + 1 : 0;
    longest = Math.max(longest, run);
  });
  return longest;
}

/**
 * Presses the × on `panel`'s legend card: the card and the link's `panel`
 * parameter go, and Back brings both back.
 */
export async function closeFromLegend(page: Page, panel: 'search' | 'overlay'): Promise<void> {
  const row = page.locator(`.map-legend-row[data-panel="${panel}"]`);
  const close = row.locator('.map-legend-close');
  const inLink = () => new URL(page.url()).searchParams.get(panel);
  const before = inLink();
  expect(before, `the link holds ${panel}`).not.toBeNull();
  await expect(close).toHaveAccessibleName(/\S/);
  await close.click();
  await expect(row).toBeHidden();
  await expect.poll(inLink).toBeNull();
  await page.goBack();
  await expect(row).toBeVisible();
  await expect.poll(inLink).toBe(before);
}

/** Attaches a screenshot for the contact sheet, only on the run that asks for them (SCREENSHOTS). */
export async function attachScreenshot(page: Page, info: TestInfo): Promise<void> {
  if (!SCREENSHOTS) return;
  const shot = info.outputPath('screen.png');
  await page.screenshot({ path: shot });
  await info.attach('layout', { path: shot, contentType: 'image/png' });
}
