// Renders the picture link previews show, from a running dev server:
// node scripts/og-image.mjs [tanakh|ieeevis] [http://localhost:5173/]
//
// The Tanakh's card is the whole map; the VIS card is a close view of the
// program, titled, and its camera needs adjusting if the layout moves.
import { chromium } from 'playwright';

const TARGETS = {
  tanakh: {
    path: '',
    camera: '?overlay=commentary&zoom=0.3&x=1700&y=780',
    out: 'public/og-image.jpg',
  },
  ieeevis: {
    path: 'ieeevis/',
    camera: '?overlay=kinds&zoom=0.7&x=715&y=300',
    title: 'IEEE VIS 2026',
    out: 'public/ieeevis-og-image.jpg',
  },
};
const target = TARGETS[process.argv[2] ?? 'tanakh'];
if (!target) throw new Error(`unknown target; one of ${Object.keys(TARGETS).join(', ')}`);
const BASE = process.argv[3] ?? 'http://localhost:5173/';
const PAGE_URL = `${BASE}${target.path}`;

// The canvas leaves room for the panel, and measures itself once at
// startup, so the panel has to be gone before the page loads, not after.
const HIDE_UI =
  '<style>#panel,#menu-toggle,#map-legend,#zoom-controls,#popup{display:none!important}:root{--map-left:0px!important}' +
  '#canvas{width:100vw!important;height:100vh!important}</style>';

// A card's title, over the band the camera leaves above the map.
const titleHtml = (text) =>
  '<div style="position:fixed;left:48px;top:14px;z-index:9;color:#fff;font:700 40px system-ui,sans-serif">' +
  `${text}</div>`;

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
await page.route(
  (url) => url.pathname === new URL(PAGE_URL).pathname,
  async (route) => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace('</head>', HIDE_UI + '</head>')
      .replace('</body>', (target.title ? titleHtml(target.title) : '') + '</body>');
    await route.fulfill({ response, body: html });
  },
);
await page.goto(`${PAGE_URL}${target.camera}`);
await page.waitForTimeout(5000);
await page.screenshot({
  path: target.out,
  type: 'jpeg',
  quality: 85,
  scale: 'css',
});
await browser.close();
console.log(`wrote ${target.out}`);
