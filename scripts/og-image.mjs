// Renders public/og-image.jpg, the picture link previews show, from a running
// dev server: node scripts/og-image.mjs [http://localhost:5173/]
//
// The camera frames the five books of the Torah above the Former Prophets,
// large enough that each verse reads as a square; adjust it if the layout moves.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const CAMERA = 'overlay=commentary&zoom=0.7&x=-1716&y=66.6';

// The canvas leaves room for the panel, and measures itself once at
// startup, so the panel has to be gone before the page loads, not after.
const HIDE_UI =
  '<style>#panel,#rail,#top-bar,#zoom-controls,#verse-popup{display:none!important}:root{--map-left:0px!important}' +
  '#canvas{width:100vw!important;height:100vh!important}</style>';

const browser = await chromium.launch({
  // Headless Chromium has no WebGL2 without software rendering.
  args: [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
// Drawn at 2× and scaled down, for smoother edges.
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.route(BASE, async (route) => {
  const response = await route.fetch();
  const html = (await response.text()).replace('</head>', HIDE_UI + '</head>');
  await route.fulfill({ response, body: html });
});
await page.goto(`${BASE}#${CAMERA}`);
await page.waitForTimeout(5000);
await page.screenshot({
  path: 'public/og-image.jpg',
  type: 'jpeg',
  quality: 85,
  scale: 'css',
});
await browser.close();
console.log('wrote public/og-image.jpg');
