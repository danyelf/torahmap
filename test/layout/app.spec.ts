import { expect } from '@playwright/test';
import { test } from '../browser/fakeMap.ts';
import { ABRAHAM, CHROME, STATES } from './app.ts';
import { measureLayout, testStates } from './check.ts';
import { NO_OVERLAY } from '@torahmap/shell/overlays/types.ts';
import {
  canvasShot,
  desktopOnly,
  DRAWN_FLOOR,
  drawnPixels,
  allLoaded,
  openMap,
  viaMenu,
} from '../browser/page.ts';
import {
  asReturningReader,
  boxes,
  closeFromLegend,
  desktopAndPhoneOnly,
  desktopTabletAndPhoneOnly,
  faintShare,
  longestDrawnRun,
  stepShare,
} from './page.ts';

test('measuring finds the panel and its controls', async ({ page }) => {
  desktopAndPhoneOnly();
  // The story has a panel on every screen; a phone exploring with nothing open has none.
  await openMap(page, 'story=tour&stop=intro');
  expect(await boxes(page, CHROME.panel)).not.toEqual([]);
  expect(await boxes(page, CHROME.interactive)).not.toEqual([]);
});

test('the rules report a layout broken on purpose', async ({ page }) => {
  desktopOnly('one screen proves the rules can fail');
  const state = STATES.find((s) => s.name === 'explore-verse-pinned')!;
  await openMap(page, state.link);
  await page.addStyleTag({
    content:
      '#panel { left: -100px !important; } #canvas { left: 0 !important; } ' +
      '#zoom-controls { left: 100px !important; right: auto !important; }',
  });
  await page.locator('#map-legend').evaluate((el) => el.remove());
  const measured = await measureLayout(page, CHROME, state.shown);
  expect(measured['chrome-in-viewport']).toContain('#panel crosses the left edge');
  expect(measured['chrome-apart']).toContainEqual(
    expect.stringMatching(/^#zoom-controls overlaps #panel by/),
  );
  expect(measured['map-clear-of-panel']).toContainEqual(
    expect.stringMatching(/^#canvas overlaps #panel by/),
  );
  expect(measured['expected-shown']).toEqual(['#map-legend matches nothing']);
});

testStates(STATES);

test("a returning reader's Search button opens search, ready to type", async ({ page }) => {
  await asReturningReader(page);
  await openMap(page, '');
  await page.locator('[data-start="search"]').click();
  await expect(page.locator('#search-input')).toBeFocused();
});

test('choosing None offers the places to start, and an overlay takes them away', async ({
  page,
}) => {
  desktopAndPhoneOnly();
  await openMap(page, 'overlay=commentary');
  await viaMenu(page, 'overlay');
  const start = page.locator('[data-start="search"]');
  await expect(start).toHaveCount(0);
  await page.locator('#overlay-select').selectOption(NO_OVERLAY);
  await expect(start).toBeVisible();
  await page.locator('#overlay-select').selectOption('haftarah');
  await expect(start).toHaveCount(0);
});

test("the haftarah legend's key shows only in the desktop layout", async ({ page }) => {
  const state = STATES.find((s) => s.name === 'explore-haftarah')!;
  await openMap(page, state.link);
  await state.then?.(page);
  // Which layout the page is in, as packages/shell/src/styles/phone.css decides it.
  const desktop = await page.evaluate(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--layout').trim() !== 'phone',
  );
  await expect(page.locator('.haftarah-key')).toBeVisible({ visible: desktop });
});

test('each language choice hides the other language in the popup', async ({ page }) => {
  desktopAndPhoneOnly();
  await openMap(page, 'overlay=commentary&verse=Genesis.12.1');
  await viaMenu(page, 'about');
  const hebrew = page.locator('#popup .popup-hebrew');
  const english = page.locator('#popup .popup-english');
  const titleHebrew = page.locator('#map-title .title-he');
  const choose = (choice: string) =>
    page.locator(`#language-choice [data-languages="${choice}"]`).click();
  await choose('he');
  await expect(hebrew).toBeVisible();
  await expect(english).toBeHidden();
  await choose('en');
  await expect(hebrew).toBeHidden();
  await expect(titleHebrew).toBeHidden();
  await expect(english).toBeVisible();
  await choose('both');
  await expect(hebrew).toBeVisible();
  await expect(titleHebrew).toBeVisible();
  await expect(english).toBeVisible();
});

test('the title face loads', async ({ page }) => {
  desktopAndPhoneOnly();
  await openMap(page, 'story=tour&stop=intro');
  // document.fonts.check() is true for a face that was never declared; load() is not.
  const faces = await page.evaluate(
    async () => (await document.fonts.load('700 32px "David Libre"')).length,
  );
  expect(faces, 'David Libre comes from Google Fonts, so this needs the network').toBeGreaterThan(
    0,
  );
});

// What the map draws, on the real map.
test.describe('the drawn map', () => {
  test.use({ realMap: true });

  test('the render check sees a map that drew nothing', async ({ page }) => {
    // No draw call runs; the clear still does.
    await page.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype as unknown as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (/^draw(Arrays|Elements|RangeElements)/.test(name)) proto[name] = () => {};
      }
    });
    await page.goto('/?overlay=commentary');
    await allLoaded(page);
    expect(await drawnPixels(page)).toBeLessThan(DRAWN_FLOOR);
  });

  test('zoomed far out, a line of verses draws as one unbroken bar', async ({ page }) => {
    desktopOnly('one screen, at one pixel to the pixel');
    // Squares 1.2 pixels wide, with 0.6 between them unless they are widened.
    await openMap(page, 'zoom=0.3');
    expect(await longestDrawnRun(page, await canvasShot(page))).toBeGreaterThan(40);
  });

  test('zoomed far out, bars keep their vertical jitter', async ({ page }) => {
    desktopOnly('one screen, at one pixel to the pixel');
    // Measured 0.087 with the jitter and 0 without it.
    await openMap(page, 'zoom=0.3');
    expect(await stepShare(page, await canvasShot(page))).toBeGreaterThan(0.04);
  });

  test('zoomed far out, a search hit glows, fading out from a solid core', async ({ page }) => {
    desktopOnly('one screen, at one pixel to the pixel');
    // Measured 0.44 with the glow and 0.08 with solid squares.
    await openMap(page, `search=${encodeURIComponent('אליהו')}&zoom=0.1`);
    expect(await faintShare(page, await canvasShot(page))).toBeGreaterThan(0.25);
  });
});

test("the search card's × clears the search, and Back brings it back", async ({ page }) => {
  desktopTabletAndPhoneOnly();
  await openMap(page, `search=${ABRAHAM}&overlay=haftarah`);
  await closeFromLegend(page, 'search');
  await expect(page.locator('.map-legend-row[data-panel="overlay"]')).toBeVisible();
});

test("a card's × during a story hands the map to the reader, the story still open", async ({
  page,
}) => {
  desktopTabletAndPhoneOnly();
  await openMap(page, 'story=tour&stop=liturgy_verse');
  const row = page.locator('.map-legend-row[data-panel="overlay"]');
  await row.locator('.map-legend-close').click();
  await expect(row).toBeHidden();
  // The link names the reader's own view rather than the stop.
  await expect.poll(() => new URL(page.url()).searchParams.get('story')).toBeNull();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'story');
});

test("the overlay card's × turns the overlay off, and Back brings it back", async ({ page }) => {
  desktopTabletAndPhoneOnly();
  await openMap(page, `search=${ABRAHAM}&overlay=haftarah`);
  await closeFromLegend(page, 'overlay');
  await expect(page.locator('.map-legend-row[data-panel="search"]')).toBeVisible();
});
