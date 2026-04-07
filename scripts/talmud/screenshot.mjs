#!/usr/bin/env node
// Screenshot the Talmud map for PR review.
// Usage: node scripts/talmud/screenshot.mjs <dev-server-port>

import { chromium } from "playwright";
import { mkdirSync } from "fs";

const port = process.argv[2] || "5175";
const outDir = "docs/plans/images/2026-04-07-talmud-integration";

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--headless=new",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (err) => {
  consoleErrors.push(`PAGEERROR: ${err.message}`);
});

console.log(`Loading http://localhost:${port}/talmud.html...`);
await page.goto(`http://localhost:${port}/talmud.html`);

// Wait for WebGL init + initial paint. The first data fetch loads
// structure.json, then layout + WebGL init run synchronously after.
await page.waitForTimeout(2000);

// 1. Full-Bavli view (the default fit-to-bounds)
await page.screenshot({
  path: `${outDir}/1-full-bavli.png`,
  fullPage: false,
});
console.log(`1-full-bavli.png`);

// 2. Zoom to Seder Moed's bounding box (the largest shelf: 11 tractates)
await page.evaluate(() => {
  const tm = window.talmudMap;
  const moed = tm.tractateBlocks.filter((t) => t.seder === "Seder Moed");
  const minX = Math.min(...moed.map((t) => t.minX));
  const minY = Math.min(...moed.map((t) => t.minY));
  const maxX = Math.max(...moed.map((t) => t.maxX));
  const maxY = Math.max(...moed.map((t) => t.maxY));
  tm.setCameraForBounds(minX, minY, maxX, maxY, 40);
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/2-seder-moed.png`, fullPage: false });
console.log(`2-seder-moed.png`);

// 3. Zoom to just Berakhot (one tractate, close detail)
await page.evaluate(() => {
  const tm = window.talmudMap;
  const b = tm.tractateBlocks.find((t) => t.name === "Berakhot");
  tm.setCameraForBounds(b.minX, b.minY, b.maxX, b.maxY, 60);
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/3-berakhot.png`, fullPage: false });
console.log(`3-berakhot.png`);

// 4. Pin a Berakhot segment to show the sidebar with Hebrew text
await page.evaluate(() => {
  const tm = window.talmudMap;
  tm.pin({ tractate: "Berakhot", daf: 2, amud: "a", segment: 1 });
});
await page.waitForTimeout(1500); // wait for Hebrew text fetch
await page.screenshot({ path: `${outDir}/4-sidebar-berakhot-2a1.png`, fullPage: false });
console.log(`4-sidebar-berakhot-2a1.png`);

// 5. Switch to segment-length overlay (Berakhot still in view)
await page.selectOption("#overlay-select", "segment-length");
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/5-overlay-segment-length.png`, fullPage: false });
console.log(`5-overlay-segment-length.png`);

console.log("\nConsole errors during session:");
if (consoleErrors.length === 0) {
  console.log("  (none)");
} else {
  for (const err of consoleErrors) console.log(`  ${err}`);
}

await browser.close();
