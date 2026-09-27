// Opening the map in headless Chromium, and what can only be learned by asking it.

import { chromium, type Browser, type Page } from 'playwright';
import type { Script } from './script.ts';
import { cameraOf, type Camera } from './timeline.ts';

/** As layout/playwright.config.ts: headless Chromium has no WebGL2 without software rendering. */
export const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export function launch(): Promise<Browser> {
  return chromium.launch({ args: LAUNCH_ARGS });
}

/**
 * Opens the map at `url` and waits until it has drawn and its fonts have
 * arrived. With `fakeClock`, time in the page moves only when the caller
 * advances it.
 */
export async function openMap(
  browser: Browser,
  url: string,
  width: number,
  height: number,
  fakeClock: boolean,
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: 'no-preference',
  });
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  if (fakeClock) await page.clock.install();
  await page.goto(url);

  const wait = (ms: number) => (fakeClock ? page.clock.runFor(ms) : page.waitForTimeout(ms));
  for (let i = 0; !(await page.locator('html[data-map-ready]').count()); i++) {
    if (i === 300) throw new Error('the map did not start within 30 seconds');
    await wait(100);
  }
  await page.evaluate(() => document.fonts.ready);
  await wait(1000);
  return page;
}

/**
 * The camera each view scene ends on. A scene that pins a verse leaves x and y
 * to the app, which centres the verse; unpinning it with Escape makes the app
 * write the camera it chose into the URL.
 */
export async function measureCameras(
  browser: Browser,
  baseUrl: string,
  script: Script,
): Promise<Map<string, Camera>> {
  const cameras = new Map<string, Camera>();
  let page: Page | null = null;
  for (const scene of script.scenes) {
    if (scene.kind !== 'view') continue;
    const given = cameraOf(scene.params);
    if (given) {
      cameras.set(scene.id, given);
      continue;
    }
    if (!scene.params.verse) {
      throw new Error(`scene "${scene.id}" needs x and y, or a verse to centre on`);
    }
    page ??= await openMap(browser, baseUrl, script.width, script.height, false);
    await page.evaluate((h) => (location.hash = h), `#${new URLSearchParams(scene.params)}`);
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const measured = cameraOf(
      Object.fromEntries(new URLSearchParams((await page.evaluate(() => location.hash)).slice(1))),
    );
    if (!measured) throw new Error(`scene "${scene.id}": could not read the camera for its verse`);
    cameras.set(scene.id, measured);
  }
  await page?.close();
  return cameras;
}
