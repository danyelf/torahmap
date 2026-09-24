import { expect, test } from '@playwright/test';
import { DRAWN_FLOOR, mapPixels, openMap } from './page.ts';

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
