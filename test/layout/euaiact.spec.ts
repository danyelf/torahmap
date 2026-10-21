// The AI Act's page, at /euaiact/: it draws, keeps the layout rules the Tanakh's page keeps, and a
// pinned square shows its text.
import { expect, test, type Page } from '@playwright/test';
import { ACT_STATES, CHROME, viaMenu } from './app.ts';
import { checkLayout } from './check.ts';
import { apart, outsideOf, overlapping, type Box } from './geometry.ts';
import { boxes, canvasShot, openMap, shown } from './page.ts';
import {
  ARTICLE_NUMBER_ZOOM,
  CHAPTER_TAB,
  COLUMN_WIDTH,
  SPLIT_GAP,
  SQUARE_SIZE,
} from '@torahmap/euaiact/constants.ts';
import { EUAIACT_PAGE, EUAIACT_PATH as ACT } from '@torahmap/euaiact/page.ts';

for (const state of ACT_STATES) {
  test(state.name, async ({ page }, info) => {
    const errors = await openMap(page, state.link, ACT);
    await state.then?.(page);
    const shot = info.outputPath('screen.png');
    await page.screenshot({ path: shot });
    await info.attach('layout', { path: shot, contentType: 'image/png' });
    await checkLayout(page, state, CHROME);
    expect(errors, 'page errors').toEqual([]);
  });
}

test('the dev server fills the Act’s page with its own copy', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop', 'what the server sends does not depend on the screen');
  for (const address of [ACT, `${ACT}index.html`, `${ACT}?at=6(2)`]) {
    const html = await (await request.get(address)).text();
    expect(html).toContain(`<title>${EUAIACT_PAGE.name}</title>`);
  }
});

test('/euaiact, without the slash, opens the same page and keeps the link', async ({ page }) => {
  await page.goto('/euaiact?at=6(2)');
  await expect(page).toHaveURL(/\/euaiact\/\?at=6\(2\)$/);
});

test("a pinned square's popup shows its text, in English, linked to EUR-Lex", async ({ page }) => {
  await openMap(page, 'at=6(2)', ACT);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Article 6(2)');
  await expect(page.locator('#popup .popup-english')).not.toBeEmpty();
  await expect(page.locator('#popup .popup-hebrew')).toBeEmpty();
  await expect(page.locator('#popup .sefaria-link')).toHaveAttribute('href', /eur-lex.*#art_6$/);
});

test('a recital is pinned by a click on its right half', async ({ page }) => {
  // Recital 1 spans x 0 to 12 at y 40 to 46; x 9 is right of where a square of its height ends.
  await openMap(page, 'zoom=6&x=9&y=43', ACT);
  const [canvas] = await boxes(page, '#canvas');
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect(page.locator('#popup.visible .ref-text')).toHaveText('Recital 1');
});

test.describe('on a dense screen', () => {
  // A ring is 2.5 CSS pixels; at three device pixels to each, a thin edge is several pixels thin.
  test.use({ deviceScaleFactor: 3 });

  test('a search hit on a recital is ringed as thick along its top as down its side', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'one screen draws the ring as any other does');
    // Recital 13, which says "deployer", fills the middle of the canvas: x 144 to 156, y 40 to 46.
    await openMap(page, 'overlay=amendment&search=deployer&zoom=12&x=150&y=43', ACT);
    await page.mouse.move(0, 0);
    const png = await canvasShot(page);
    const { across, down } = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      // The search's cyan, #1ab3cc.
      const ring = (x: number, y: number) => {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        return Math.abs(r - 26) + Math.abs(g - 179) + Math.abs(b - 204) < 60;
      };
      // From the recital's middle outward: its fill, then its ring, a run of orange.
      const run = (step: (i: number) => [number, number]) => {
        let i = 0;
        while (i < 2000 && !ring(...step(i))) i++;
        let n = 0;
        while (ring(...step(i + n))) n++;
        return n;
      };
      const mx = Math.floor(c.width / 2);
      const my = Math.floor(c.height / 2);
      return { across: run((i) => [mx - i, my]), down: run((i) => [mx, my - i]) };
    }, png.toString('base64'));
    expect(across).toBeGreaterThan(0);
    expect(Math.abs(down - across)).toBeLessThanOrEqual(1);
  });
});

test('a link to a square that does not exist pins nothing', async ({ page }) => {
  const errors = await openMap(page, 'at=999(9)', ACT);
  await expect(page.locator('#popup.visible')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('names every chapter and annex, in English, once its tabs are big enough', async ({
  page,
}) => {
  // The tabs fade out below zoom 0.58; a phone's opening view sits under it.
  await openMap(page, 'zoom=0.6', ACT);
  // A small screen holds only part of the map, so one name on it is enough.
  expect(await boxes(page, '#book-labels .book-label-en')).not.toEqual([]);
  const unnamed = await page.$$eval(
    '#book-labels .book-label',
    (els) =>
      els.filter((el) => {
        const en = el.querySelector('.book-label-en');
        return !en?.textContent?.trim() || getComputedStyle(en).display === 'none';
      }).length,
  );
  expect(unnamed).toBe(0);
});

test('offers no language choice, and never writes one', async ({ page }) => {
  await openMap(page, 'zoom=0.6', ACT);
  await viaMenu(page, 'about');
  await expect(page.locator('#about-panel')).toBeVisible();
  await expect(page.locator('#language-choice')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('torahMap.languages'))).toBeNull();
});

const NUMBERS = '#act-article-numbers .row-number';

/** The article squares on screen, from the page's own layout, placed by Chapter III's name. */
async function squaresOnScreen(page: Page, zoom: number): Promise<Box[]> {
  const [{ full: label }] = await shown(page, '#book-labels [data-book-name="Ch. III"]');
  const [view] = await boxes(page, '#canvas');
  const squares: Box[] = await page.evaluate(
    async ({ label, zoom, tab }) => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const { computeActLayout } = await load('/apps/euaiact/src/layout.ts');
      const { SQUARE_GAP } = await load('/packages/engine/src/index.ts');
      const laid = computeActLayout(await (await fetch('/data/euaiact/structure.json')).json());
      const three = laid.books.find((b: { name: string }) => b.name === 'Ch. III');
      return laid.items
        .filter((s: { layer: string }) => s.layer === 'article')
        .map((s: { id: string; x: number; y: number; size: number }) => ({
          name: s.id,
          x: label.x + (s.x - three.minX - tab.inset) * zoom,
          y: label.y + (s.y - three.minY + tab.above) * zoom,
          width: (s.size - SQUARE_GAP) * zoom,
          height: (s.size - SQUARE_GAP) * zoom,
        }));
    },
    { label, zoom, tab: CHAPTER_TAB },
  );
  return squares.filter((b) => outsideOf([b], view).length === 0);
}

// Chapter III's first two sections, a split chapter's columns, which stand closest together.
const chapterThree = (zoom: number) => `zoom=${zoom}&x=215&y=200`;

test('articles are numbered only from their zoom', async ({ page }) => {
  await openMap(page, chapterThree(ARTICLE_NUMBER_ZOOM - 0.1), ACT);
  expect(await boxes(page, NUMBERS)).toEqual([]);
  await openMap(page, chapterThree(ARTICLE_NUMBER_ZOOM), ACT);
  expect(await boxes(page, NUMBERS)).not.toEqual([]);
});

test('every article number stops short of the next column and is clear of every other', async ({
  page,
}) => {
  await openMap(page, chapterThree(ARTICLE_NUMBER_ZOOM), ACT);
  // Off screen too: every number shows from the same zoom.
  const numbers = (await shown(page, NUMBERS)).map((s) => s.full);
  expect(numbers).not.toEqual([]);
  // The columns of a split chapter stand closest together.
  const pitch = (COLUMN_WIDTH * SQUARE_SIZE + SPLIT_GAP) * ARTICLE_NUMBER_ZOOM;
  expect(numbers.filter((n) => n.width >= pitch)).toEqual([]);
  expect(overlapping(numbers)).toEqual([]);
});

for (const zoom of [ARTICLE_NUMBER_ZOOM, 2, 4]) {
  test(`at zoom ${zoom}, no article number touches a square or a chapter's name`, async ({
    page,
  }) => {
    await openMap(page, chapterThree(zoom), ACT);
    const numbers = await boxes(page, NUMBERS);
    expect(numbers).not.toEqual([]);
    expect(apart(numbers, await squaresOnScreen(page, zoom))).toEqual([]);
    expect(apart(numbers, await boxes(page, '#book-labels .book-label'))).toEqual([]);
  });
}
