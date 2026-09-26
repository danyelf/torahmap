import { expect, test } from '@playwright/test';
import { CHROME, STATES } from './app.ts';
import { checkLayout, measureLayout } from './check.ts';
import { boxes, DRAWN_FLOOR, drawnPixels, mapReady, openMap } from './page.ts';

test('the render check sees a map that drew nothing', async ({ page }) => {
  // The map draws with drawArrays alone (src/rendering.ts); the clear still runs.
  await page.addInitScript(() => {
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });
  await page.goto('/#overlay=commentary');
  await mapReady(page);
  expect(await drawnPixels(page)).toBeLessThan(DRAWN_FLOOR);
});

test('measuring finds the panel and its controls', async ({ page }) => {
  // The story has a panel on every screen; a phone exploring with nothing open has none.
  await openMap(page, 'story=intro');
  expect(await boxes(page, CHROME.panel)).not.toEqual([]);
  expect(await boxes(page, CHROME.interactive)).not.toEqual([]);
});

test('the rules report a layout broken on purpose', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one screen proves the rules can fail');
  const state = STATES.find((s) => s.name === 'explore-verse-pinned')!;
  await openMap(page, state.hash);
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

for (const state of STATES) {
  test(state.name, async ({ page }, info) => {
    const errors = await openMap(page, state.hash);
    await state.then?.(page);
    expect(errors, `page errors after opening ${state.name}`).toEqual([]);
    const shot = info.outputPath('screen.png');
    await page.screenshot({ path: shot });
    await info.attach('layout', { path: shot, contentType: 'image/png' });
    await checkLayout(page, state, CHROME);
    expect(errors, 'page errors while measuring').toEqual([]);
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
