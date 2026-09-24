// Screenshots each multi-hit style at a wide and a close framing, for comparing
// them side by side: node scripts/multi-hit-shots.mjs <base-url> <out-dir>
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const STYLES = process.argv[4]?.split(',') ?? [
  'scatter',
  'coarse',
  'dense',
  'wedges',
  'wedges-big',
  'rings',
];
const QUERY = 'overlay=search&q=Abraham,Isaac,Jacob,Sarah';
const FRAMES = {
  wide: 'zoom=0.7&x=-1716&y=66.6',
  genesis: 'zoom=1.5&x=-2760&y=30',
  close: 'zoom=4&x=-3050&y=-120',
  exodus: 'zoom=4&x=-2790&y=49',
};

const HIDE_UI =
  '<style>#right-panel,#zoom-controls,#verse-popup{display:none!important}' +
  '#canvas{width:100vw!important;height:100vh!important}</style>';

const browser = await chromium.launch({
  args: [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
for (const style of STYLES) {
  for (const [frame, camera] of Object.entries(FRAMES)) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 2,
    });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    const url = `${BASE}?multi=${style}`;
    await page.route(url, async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace('</head>', HIDE_UI + '</head>');
      await route.fulfill({ response, body: html });
    });
    await page.goto(`${url}#${QUERY}&${camera}`);
    await page.waitForTimeout(6000);
    const path = `${OUT}/${style.replace(/[&=]/g, '-')}-${frame}.png`;
    await page.screenshot({ path, scale: 'css' });
    console.log('wrote', path);
    await page.close();
  }
}
await browser.close();
