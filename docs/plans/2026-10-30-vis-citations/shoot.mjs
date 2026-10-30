// Takes the sketch pictures: node shoot.mjs <base url> <out dir> [names]. Needs VISITED_KEY set to the shell's visited-key.
import { chromium } from 'playwright';
const [base, out, ...which] = process.argv.slice(2);
const KEY = process.env.VISITED_KEY;
const MUNZNER = 'Visualization analysis and design (2014) Tamara Munzner';
const shots = {
  'people-map': { link: 'overlay=citedpeople&cpeople=Tamara Munzner,Jeffrey Heer&at=300.0&zoom=0.45' },
  'people-panel': { link: 'overlay=citedpeople&cpeople=Tamara Munzner,Jeffrey Heer', menu: true, type: 'wang' },
  'work-map': { link: `overlay=citedworks&cworks=${MUNZNER}&at=300.0&zoom=0.45` },
  'work-panel': { link: `overlay=citedworks&cworks=${MUNZNER}`, menu: true, type: 'vega' },
  'paper-arcs-wide': { link: 'overlay=sharedcitations&at=94.0&zoom=0.5', arcs: true },
  'paper-arcs-close': { link: 'overlay=sharedcitations&at=94.0&zoom=0.9', arcs: true, menu: true },
};
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, s] of Object.entries(shots)) {
  if (which.length && !which.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  await page.addInitScript(([k, arcs]) => { localStorage.setItem(k, 'true'); window.__arcs = arcs; }, [KEY, !!s.arcs]);
  await page.goto(`${base}/ieeevis/?${s.link}`);
  await page.waitForTimeout(6000);
  await page.addStyleTag({ content: '#popup{display:none !important}' });
  if (s.menu) {
    await page.locator('#menu-toggle').click();
    await page.locator('.menu-item[data-action="overlay"]:visible').click();
    await page.waitForTimeout(800);
    if (s.type) { await page.locator('.pick-input').fill(s.type); await page.waitForTimeout(800); }
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}
await browser.close();
