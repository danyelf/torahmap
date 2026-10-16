// The Talmud page, at /talmud/: it draws, its labels sit over the map, and a pinned segment
// shows its text.
import { expect, test, type Page } from '@playwright/test';
import { allLoaded, boxes, openMap, shown } from './page.ts';
import { apart, outsideOf, type Box } from './geometry.ts';
import { TALMUD_PAGE, TALMUD_PATH as TALMUD } from '@torahmap/talmud/page.ts';

/** Whole boxes, so what is off screen is checked too. */
const full = async (page: Page, selector: string) =>
  (await shown(page, selector)).map((s) => s.full).filter((b) => b.width > 0);

/** Each of `labels` that is not inside exactly one tractate's book. */
async function outsideOneBook(page: Page, labels: Box[]): Promise<string[]> {
  const books = await full(page, '#talmud-books > *');
  return labels
    .filter((l) => books.filter((b) => outsideOf([l], b).length === 0).length !== 1)
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

/**
 * The squares on screen, from the page's own layout, placed by the first tractate's book, whose box
 * the layout also gives.
 */
async function squaresOnScreen(page: Page): Promise<Box[]> {
  const tint = (await full(page, '#talmud-books > *'))[0];
  const view = (await boxes(page, '#canvas'))[0];
  const squares: Box[] = await page.evaluate(async (tint) => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { computeTalmudLayout } = await load('/apps/talmud/src/layout.ts');
    const { SQUARE_GAP } = await load('/packages/engine/src/index.ts');
    const laid = computeTalmudLayout(await (await fetch('/data/talmud/structure.json')).json());
    const world = laid.books[0];
    const zoom = tint.width / (world.maxX - world.minX);
    return laid.items.map((s: { id: string; x: number; y: number; size: number }) => ({
      name: s.id,
      x: tint.x + (s.x - world.minX) * zoom,
      y: tint.y + (s.y - world.minY) * zoom,
      width: (s.size - SQUARE_GAP) * zoom,
      height: (s.size - SQUARE_GAP) * zoom,
    }));
  }, tint);
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
    await openMap(page, '', TALMUD);
    // Berakhot's top-right corner, near the canvas's top-right.
    const corner = await berakhotCorner(page);
    const view = await boxes(page, '#canvas');
    const x = Math.round(corner.x - (view[0].width / 2 - 100) / zoom);
    const y = Math.round(corner.y + (view[0].height / 2 - 100) / zoom);
    await openMap(page, `zoom=${zoom}&x=${x}&y=${y}`, TALMUD);

    const names = await full(page, '#book-labels .book-label');
    expect(names).not.toEqual([]);
    expect(await outsideOneBook(page, names)).toEqual([]);
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
    await openMap(page, `at=Berakhot.2a.1&zoom=${zoom}`, TALMUD);
    expect((await boxes(page, '#talmud-daf-labels .daf')).length > 0).toBe(labelled);
    expect((await boxes(page, '#talmud-perek-labels > *')).length > 0).toBe(labelled);
  });
}

for (const zoom of [0.7, 2]) {
  test(`at zoom ${zoom}, every daf number sits inside its book`, async ({ page }) => {
    await openMap(page, `at=Berakhot.2a.1&zoom=${zoom}`, TALMUD);
    const dapim = await full(page, '#talmud-daf-labels .daf');
    expect(dapim).not.toEqual([]);
    expect(await outsideOneBook(page, dapim)).toEqual([]);
  });
}

for (const zoom of [0.7, 1, 1.5]) {
  test(`at zoom ${zoom}, no daf number touches a square`, async ({ page }) => {
    // Shabbat wraps into several columns, each numbered beside the next.
    await openMap(page, `at=Shabbat.2a.1&zoom=${zoom}`, TALMUD);
    const dapim = await boxes(page, '#talmud-daf-labels .daf');
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

test('the dev server fills the Talmud’s page with its own copy', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop', 'what the server sends does not depend on the screen');
  for (const address of [TALMUD, `${TALMUD}index.html`, `${TALMUD}?at=Berakhot.2a.1`]) {
    const html = await (await request.get(address)).text();
    expect(html).toContain(`<title>${TALMUD_PAGE.name}</title>`);
    expect(html).toContain(`content="${TALMUD_PAGE.tagline}"`);
  }
});

test("a pinned segment's popup shows its text", async ({ page }) => {
  const errors = await openMap(page, 'at=Berakhot.2a.1', TALMUD);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Berakhot 2a:1');
  await expect(page.locator('#popup .popup-hebrew')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('a link to a segment that does not exist pins nothing', async ({ page }) => {
  await openMap(page, 'at=Berakhot.999a.1', TALMUD);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
  await expect(page.locator('#popup.visible')).toHaveCount(0);
});

test("a tractate file that fails says so, and isn't fetched again", async ({ page }) => {
  let requests = 0;
  await page.route('**/talmud/texts/Berakhot.json', (route) => {
    requests++;
    return route.fulfill({ status: 404 });
  });
  // Not openMap: the failed download is reported, as a console error.
  await page.goto(`${TALMUD}?at=Berakhot.2a.1`);
  await allLoaded(page);
  await expect(page.locator('#popup .popup-notice')).not.toBeEmpty();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#popup .ref-text')).toHaveText('Berakhot 2a:1');
  expect(requests).toBe(1);
});

test("a link's search reaches the Talmud's own search, not the Tanakh's", async ({ page }) => {
  const searchFiles: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/search/')) searchFiles.push(request.url());
  });
  await openMap(page, 'search=משנה', TALMUD);
  await expect(page.locator('#search-input')).toHaveValue('משנה');
  expect(searchFiles).toEqual([]);
});

test('/talmud, without the slash, opens the same page and keeps the link', async ({ page }) => {
  await page.goto('/talmud?at=Berakhot.2a.1');
  await expect(page).toHaveURL(/\/talmud\/\?at=Berakhot\.2a\.1$/);
  await expect(page.locator('#talmud-labels')).toHaveCount(1);
});
