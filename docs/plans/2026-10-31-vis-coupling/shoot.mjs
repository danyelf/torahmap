// node shoot.mjs <base url> <out dir> [names]
import { chromium } from 'playwright';
const [base, out, ...which] = process.argv.slice(2);
const shots = {
  'clusters-8': { link: 'overlay=clusters8&zoom=0.5', menu: true },
  'clusters-12': { link: 'overlay=clusters12&zoom=0.5', menu: true },
  'overlap-94-count': { link: 'overlay=overlapcount&at=94.0&zoom=0.5', menu: true },
  'overlap-94-cosine': { link: 'overlay=overlapcosine&at=94.0&zoom=0.5', menu: true },
  'overlap-94-tfidf': { link: 'overlay=overlaptfidf&at=94.0&zoom=0.5', menu: true },
  'overlap-182-tfidf': { link: 'overlay=overlaptfidf&at=182.0&zoom=0.33', menu: true },
};
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
for (const [name, s] of Object.entries(shots)) {
  if (which.length && !which.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  await page.addInitScript(() => localStorage.setItem('torahMap.visited', 'true'));
  await page.goto(`${base}/ieeevis/?${s.link}`);
  await page.waitForTimeout(6000);
  await page.addStyleTag({ content: '#popup{display:none !important}' });
  if (s.menu) {
    await page.locator('#menu-toggle').click();
    await page.locator('.menu-item[data-action="overlay"]:visible').click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}
await browser.close();
