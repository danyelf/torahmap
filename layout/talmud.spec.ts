// The Talmud page, at /talmud/: it draws, its labels sit over the map, and a pinned segment
// shows its text.
import { expect, test } from '@playwright/test';
import { allLoaded, boxes, openMap, shown } from './page.ts';
import { apart, outsideOf } from './geometry.ts';
import { TALMUD_PAGE, TALMUD_PATH as TALMUD } from '@torahmap/talmud/page.ts';

test('the Talmud map draws, and names its tractates only once they are big enough to read', async ({
  page,
}) => {
  await openMap(page, '', TALMUD);
  expect(await shown(page, '#book-labels .book-label')).not.toEqual([]);
  expect(await boxes(page, '#book-labels .book-label')).toEqual([]);
});

for (const zoom of [0.4, 1, 2]) {
  test(`at zoom ${zoom}, each tractate's name sits inside its seder's box, clear of the perek names`, async ({
    page,
  }) => {
    await openMap(page, '', TALMUD);
    // Berakhot's top-right corner, near the canvas's top-right.
    const corner = await page
      .locator('#book-labels .book-label')
      .first()
      .evaluate((l: HTMLElement) => ({ x: +l.dataset.rightX!, y: +l.dataset.topY! }));
    const view = await boxes(page, '#canvas');
    const x = Math.round(corner.x - (view[0].width / 2 - 100) / zoom);
    const y = Math.round(corner.y + (view[0].height / 2 - 100) / zoom);
    await openMap(page, `zoom=${zoom}&x=${x}&y=${y}`, TALMUD);

    // Whole boxes, so the tractates off screen are checked too.
    const full = async (selector: string) =>
      (await shown(page, selector)).map((s) => s.full).filter((b) => b.width > 0);
    const names = await full('#book-labels .book-label');
    const sedarim = await full('#talmud-seder-bgs > *');
    expect(names).not.toEqual([]);
    for (const name of names) {
      const within = sedarim.filter((s) => outsideOf([name], s).length === 0);
      expect(within, `${name.name} at ${name.x},${name.y}`).toHaveLength(1);
    }
    expect(apart(names, await full('#talmud-perek-labels > *'))).toEqual([]);
  });
}

for (const [zoom, labelled] of [
  [0.35, false],
  [0.5, true],
] as const) {
  test(`at zoom ${zoom}, the dapim are numbered only if the tractates are named`, async ({
    page,
  }) => {
    await openMap(page, `at=Berakhot.2a.1&zoom=${zoom}`, TALMUD);
    expect((await boxes(page, '#talmud-daf-labels > *')).length > 0).toBe(labelled);
    expect((await boxes(page, '#book-labels .book-label')).length > 0).toBe(labelled);
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
