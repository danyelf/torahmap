// Redraws the pictures link previews show, on the runs that take screenshots
// (npm run shots, npm run test:layout:shots). Each camera is worked out from the layout.
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from '../browser/fakeMap.ts';
import { desktopOnly, hold, openMap } from '../browser/page.ts';
import { standInTextsFile } from './visTexts.ts';
import { computeLayout as computeTanakhLayout, getLayoutBounds } from '@torahmap/tanakh/layout.ts';
import { computeLayout as computeVisLayout, programBox } from '@torahmap/ieeevis/layout.ts';
import { IEEEVIS_PATH } from '@torahmap/ieeevis/page.ts';
import { STRUCTURE_FILE as TANAKH_STRUCTURE } from '@torahmap/tanakh/verseTexts.ts';
import {
  STRUCTURE_FILE as VIS_STRUCTURE,
  TEXTS_FILE as VIS_TEXTS,
} from '@torahmap/ieeevis/data.ts';

const CARD = { width: 1200, height: 630 };
/** Screen pixels left clear around the map. */
const MARGIN = 48;

// The canvas leaves room for the panel and measures itself once at startup,
// so the panel has to be gone before the page loads, not after.
const HIDE_UI =
  '<style>#panel,#menu-toggle,#map-legend,#zoom-controls,#popup{display:none!important}' +
  ':root{--map-left:0px!important}#canvas{width:100vw!important;height:100vh!important}</style>';

const readJson = (file: string): unknown => JSON.parse(readFileSync(`public/data/${file}`, 'utf8'));

/** A link's camera showing `box` across the card's width, its top `top` pixels down; `fitHeight` shows all of it. */
function cardCamera(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  top: number,
  fitHeight: boolean,
): string {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const fits = [(CARD.width - 2 * MARGIN) / width];
  if (fitHeight) fits.push((CARD.height - top - MARGIN) / height);
  const zoom = Math.floor(Math.min(...fits) * 100) / 100;
  const x = box.minX + width / 2;
  const y = box.minY + (CARD.height / 2 - top) / zoom;
  return `zoom=${zoom}&x=${x.toFixed(1)}&y=${y.toFixed(1)}`;
}

test.describe('share cards', () => {
  test.skip(!process.env.SCREENSHOTS, 'the cards are redrawn only by the screenshot run');
  test.use({ realMap: true, viewport: CARD, deviceScaleFactor: 2 });

  const draw = async (
    page: import('@playwright/test').Page,
    { path, link, out }: { path: string; link: string; out: string },
  ) => {
    desktopOnly('the card is drawn once, at its own size');
    await page.route(
      (url) => url.pathname === path,
      async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace('</head>', HIDE_UI + '</head>');
        await route.fulfill({ response, body: html });
      },
    );
    await openMap(page, link, path);
    writeFileSync(out, await page.screenshot({ type: 'jpeg', quality: 85, scale: 'css' }));
  };

  test('the Tanakh card shows the whole map', async ({ page }) => {
    const bounds = getLayoutBounds(computeTanakhLayout(readJson(TANAKH_STRUCTURE) as never));
    const box = { minX: 0, minY: 0, maxX: bounds.width, maxY: bounds.height };
    await draw(page, {
      path: '/',
      link: `overlay=commentary&${cardCamera(box, MARGIN, true)}`,
      out: 'public/og-image.jpg',
    });
  });

  test('the VIS card shows the days across and the top of each', async ({ page }) => {
    (await hold(page, [VIS_TEXTS], standInTextsFile()))();
    const laid = computeVisLayout(readJson(VIS_STRUCTURE) as never);
    await draw(page, {
      path: IEEEVIS_PATH,
      link: `overlay=kinds&${cardCamera(programBox(laid), MARGIN, false)}`,
      out: 'public/ieeevis-og-image.jpg',
    });
  });
});
