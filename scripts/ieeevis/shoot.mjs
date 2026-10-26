// Screenshots of the running VIS Map: node shoot.mjs <url> <out.png> [zoom-in x y clicks]
import { chromium } from 'playwright';

const [url, out, x, y, clicks] = process.argv.slice(2);
const browser = await chromium.launch({
  args: [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(url);
await page.waitForTimeout(4000);
if (x) {
  await page.mouse.move(Number(x), Number(y));
  for (let i = 0; i < Number(clicks); i++) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
await browser.close();
