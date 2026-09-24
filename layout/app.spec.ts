import { expect, test } from '@playwright/test';
import { CHROME, STATES } from './app.ts';
import { checkLayout } from './check.ts';
import { boxes, DRAWN_FLOOR, mapPixels, openMap } from './page.ts';

test('the map renders in more than one colour with an overlay on', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  const { drawn, colours } = await mapPixels(page);
  expect(drawn).toBeGreaterThan(DRAWN_FLOOR);
  expect(colours).toBeGreaterThanOrEqual(8);
});

test('the render check sees a map that drew nothing', async ({ page }) => {
  // The map draws with drawArrays alone (src/rendering.ts); the clear still runs.
  await page.addInitScript(() => {
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });
  await page.goto('/#overlay=commentary');
  await page.locator('html[data-map-ready]').waitFor({ state: 'attached', timeout: 30_000 });
  expect((await mapPixels(page)).drawn).toBeLessThan(DRAWN_FLOOR);
});

test('measuring finds the panel and its controls', async ({ page }) => {
  await openMap(page, 'overlay=commentary');
  expect(await boxes(page, CHROME.panel)).not.toEqual([]);
  expect(await boxes(page, CHROME.interactive)).not.toEqual([]);
});

for (const state of STATES) {
  test(state.name, async ({ page }, info) => {
    await openMap(page, state.hash);
    await state.then?.(page);
    const shot = info.outputPath('screen.png');
    await page.screenshot({ path: shot });
    await info.attach('layout', { path: shot, contentType: 'image/png' });
    await checkLayout(page, state.name, CHROME);
  });
}

test('the title face loads', async ({ page }) => {
  await openMap(page, 'story=intro');
  // document.fonts.check() is true for a face that was never declared; load() is not.
  const faces = await page.evaluate(
    async () => (await document.fonts.load('700 32px "David Libre"')).length,
  );
  expect(faces, 'David Libre comes from Google Fonts, so this needs the network').toBeGreaterThan(
    0,
  );
});
