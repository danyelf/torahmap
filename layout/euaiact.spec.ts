// The AI Act's page, at /euaiact/: it draws, keeps the layout rules the Tanakh's page keeps, and a
// pinned square shows its text.
import { expect, test } from '@playwright/test';
import { ACT_STATES, CHROME, viaMenu } from './app.ts';
import { checkLayout } from './check.ts';
import { boxes, canvasShot, openMap } from './page.ts';
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
      // The search's orange, #e8833a.
      const ring = (x: number, y: number) => {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        return Math.abs(r - 232) + Math.abs(g - 131) + Math.abs(b - 58) < 60;
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

test('offers no Hebrew control, and never writes the Hebrew choice', async ({ page }) => {
  await openMap(page, 'zoom=0.6', ACT);
  await viaMenu(page, 'about');
  await expect(page.locator('#about-panel')).toBeVisible();
  await expect(page.locator('#hebrew-toggle')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('torahMap.englishOnly'))).toBeNull();
});
