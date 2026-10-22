// The Talmud page, at /talmud/: it draws, its labels sit over the map, and a pinned segment
// shows its text.
import { expect, test, type Page } from '@playwright/test';
import { openMap, viaMenu } from '../browser/page.ts';
import {
  boxes,
  closeFromLegend,
  desktopAndPhoneOnly,
  desktopTabletAndPhoneOnly,
  shown,
} from './page.ts';
import { apart, outsideOf, type Box } from './geometry.ts';
import { TALMUD_PATH as TALMUD } from '@torahmap/talmud/page.ts';

/** Whole boxes, so what is off screen is checked too. */
const full = async (page: Page, selector: string) =>
  (await shown(page, selector)).map((s) => s.full).filter((b) => b.width > 0);

/** Each of `labels` that is not inside exactly one tractate's cover. */
async function outsideOneCover(page: Page, labels: Box[]): Promise<string[]> {
  const covers = await full(page, '#talmud-books > *');
  return labels
    .filter((l) => covers.filter((c) => outsideOf([l], c).length === 0).length !== 1)
    .map((l) => `${l.name} at ${l.x},${l.y}`);
}

/** Berakhot's top-right corner, in map units, from the page's own layout. */
const berakhotCorner = (page: Page) =>
  page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { computeTalmudLayout } = await load('/apps/talmud/src/layout.ts');
    const laid = computeTalmudLayout(await (await fetch('/data/talmud/structure.json')).json());
    return { x: laid.tractateBlocks[0].maxX as number, y: laid.tractateBlocks[0].minY as number };
  });

/** Moves the map to `link` as Back to it does, without loading the page again. */
async function backTo(page: Page, link: string): Promise<void> {
  await page.evaluate((link) => {
    history.pushState(null, '', `?${link}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, link);
  // The labels fade in or out as the zoom changes.
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

/**
 * The squares on screen, from the page's own layout, placed by the first tractate's cover, whose box
 * the layout also gives.
 */
async function squaresOnScreen(page: Page): Promise<Box[]> {
  const cover = (await full(page, '#talmud-books > *'))[0];
  const view = (await boxes(page, '#canvas'))[0];
  const squares: Box[] = await page.evaluate(async (cover) => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { computeTalmudLayout } = await load('/apps/talmud/src/layout.ts');
    const { SQUARE_GAP } = await load('/packages/engine/src/index.ts');
    const laid = computeTalmudLayout(await (await fetch('/data/talmud/structure.json')).json());
    const world = laid.tractateBlocks[0].cover;
    const zoom = cover.width / (world.maxX - world.minX);
    return laid.items.map((s: { id: string; x: number; y: number; size: number }) => ({
      name: s.id,
      x: cover.x + (s.x - world.minX) * zoom,
      y: cover.y + (s.y - world.minY) * zoom,
      width: (s.size - SQUARE_GAP) * zoom,
      height: (s.size - SQUARE_GAP) * zoom,
    }));
  }, cover);
  return squares.filter((b) => outsideOf([b], view).length === 0);
}

test('the Talmud map draws, and names its tractates only once they are big enough to read', async ({
  page,
}) => {
  await openMap(page, '', TALMUD);
  expect(await shown(page, '#book-labels .book-label')).not.toEqual([]);
  expect(await boxes(page, '#book-labels .book-label')).toEqual([]);
});

for (const zoom of [0.4, 1, 2]) {
  test(`at zoom ${zoom}, each tractate's name sits inside its book, clear of the perek names`, async ({
    page,
  }) => {
    desktopAndPhoneOnly();
    await openMap(page, '', TALMUD);
    // Berakhot's top-right corner, near the canvas's top-right.
    const corner = await berakhotCorner(page);
    const [view] = await boxes(page, '#canvas');
    const x = Math.round(corner.x - (view.width / 2 - 100) / zoom);
    const y = Math.round(corner.y + (view.height / 2 - 100) / zoom);
    await backTo(page, `zoom=${zoom}&x=${x}&y=${y}`);

    const names = await full(page, '#book-labels .book-label');
    expect(names).not.toEqual([]);
    expect(await outsideOneCover(page, names)).toEqual([]);
    expect(apart(names, await full(page, '#talmud-perek-labels > *'))).toEqual([]);
  });
}

for (const [zoom, labelled] of [
  [0.6, false],
  [0.8, true],
] as const) {
  test(`at zoom ${zoom}, the dapim are numbered only if the perakim are named`, async ({
    page,
  }) => {
    desktopAndPhoneOnly();
    await openMap(page, `at=Berakhot.2a.1&zoom=${zoom}`, TALMUD);
    expect((await boxes(page, '#talmud-daf-labels .row-number')).length > 0).toBe(labelled);
    expect((await boxes(page, '#talmud-perek-labels > *')).length > 0).toBe(labelled);
  });
}

for (const zoom of [0.7, 2]) {
  test(`at zoom ${zoom}, every daf number sits inside its book`, async ({ page }) => {
    desktopAndPhoneOnly();
    await openMap(page, `at=Berakhot.2a.1&zoom=${zoom}`, TALMUD);
    const dapim = await full(page, '#talmud-daf-labels .row-number');
    expect(dapim).not.toEqual([]);
    expect(await outsideOneCover(page, dapim)).toEqual([]);
  });
}

for (const zoom of [0.7, 1, 1.5]) {
  test(`at zoom ${zoom}, no daf number touches a square`, async ({ page }) => {
    desktopAndPhoneOnly();
    // Shabbat wraps into several columns, each numbered beside the next.
    await openMap(page, `at=Shabbat.2a.1&zoom=${zoom}`, TALMUD);
    const dapim = await boxes(page, '#talmud-daf-labels .row-number');
    expect(dapim).not.toEqual([]);
    expect(apart(dapim, await squaresOnScreen(page))).toEqual([]);
  });
}

test('the Talmud opens with every seder’s label on the map', async ({ page }) => {
  await openMap(page, '', TALMUD);
  const map = (await boxes(page, '#canvas'))[0];
  const sedarim = await shown(page, '#book-labels [data-section]');
  expect(sedarim).not.toEqual([]);
  expect(
    outsideOf(
      sedarim.map((s) => s.full),
      map,
    ),
  ).toEqual([]);
});

test("a pinned segment's popup shows its text", async ({ page }) => {
  desktopAndPhoneOnly();
  const errors = await openMap(page, 'at=Berakhot.2a.1', TALMUD);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Berakhot 2a:1');
  await expect(page.locator('#popup .popup-hebrew')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("the Talmud's language choice hides the other language in the popup", async ({ page }) => {
  desktopAndPhoneOnly();
  await openMap(page, 'at=Berakhot.2a.1', TALMUD);
  await viaMenu(page, 'about');
  const hebrew = page.locator('#popup .popup-hebrew');
  const english = page.locator('#popup .popup-english');
  const choose = (choice: string) =>
    page.locator(`#language-choice [data-languages="${choice}"]`).click();
  await choose('he');
  await expect(hebrew).toBeVisible();
  await expect(english).toBeHidden();
  await choose('en');
  await expect(hebrew).toBeHidden();
  await expect(english).toBeVisible();
});

test('a link to a segment that does not exist pins nothing', async ({ page }) => {
  desktopAndPhoneOnly();
  await openMap(page, 'at=Berakhot.999a.1', TALMUD);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
  await expect(page.locator('#popup.visible')).toHaveCount(0);
});

test('a Talmud search lists the segments it finds, each quoted with its match marked', async ({
  page,
}, info) => {
  desktopAndPhoneOnly();
  const errors = await openMap(page, `search=${encodeURIComponent('רבי יוחנן')}`, TALMUD);
  await viaMenu(page, 'search');
  await expect(page.locator('.search-result .snippet mark').first()).toBeVisible();
  const shot = info.outputPath('screen.png');
  await page.screenshot({ path: shot });
  await info.attach('layout', { path: shot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('a Talmud search result, clicked, pins its segment', async ({ page }) => {
  desktopTabletAndPhoneOnly();
  await openMap(page, `search=${encodeURIComponent('קל וחומר')}`, TALMUD);
  await viaMenu(page, 'search');
  const first = page.locator('.search-result').first();
  const ref = (await first.locator('.ref').textContent())!.trim();
  await first.click();
  await expect(page.locator('#popup.visible .ref-text')).toHaveText(ref);
});

test('an English Talmud search lists what it finds, and marks the popup’s English only in bold', async ({
  page,
}, info) => {
  desktopAndPhoneOnly();
  // Berakhot 2a:1 says Shema in its bold translation and in the explanation around it.
  const errors = await openMap(page, 'search=shema&at=Berakhot.2a.1', TALMUD);
  await viaMenu(page, 'search');
  await expect(page.locator('.search-result .snippet mark').first()).toBeVisible();
  const marks = page.locator('#popup .popup-english mark');
  await expect(marks.first()).toBeVisible();
  const outsideBold = await marks.evaluateAll((all) =>
    all.filter((mark) =>
      [...mark.childNodes].some((node) => node.nodeType !== 1 || (node as Element).tagName !== 'B'),
    ),
  );
  expect(outsideBold).toHaveLength(0);
  await marks.first().scrollIntoViewIfNeeded();
  const shot = info.outputPath('screen.png');
  await page.screenshot({ path: shot });
  await info.attach('layout', { path: shot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test("the Talmud's search card's × clears the search, and Back brings it back", async ({
  page,
}) => {
  desktopTabletAndPhoneOnly();
  await openMap(page, `search=${encodeURIComponent('משנה')}`, TALMUD);
  await closeFromLegend(page, 'search');
});
