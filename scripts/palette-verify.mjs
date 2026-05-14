#!/usr/bin/env node
// scripts/palette-verify.mjs
// Playwright screenshot harness for human visual review of palette themes.
// For each (theme × state) tuple, navigates to the app, waits for the canvas
// to render, and saves a PNG under docs/plans/data/palettes/<theme>/<state>.png.
//
// Companion to scripts/palette-assert.mjs (programmatic pixel assertions).
// Assertions are the gate; this script is for human eyes.
//
// Usage:
//   npm run palette:verify            # against http://localhost:5173
//   PROBE_URL=http://localhost:4173 npm run palette:verify

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Headless Chromium needs an explicit GL backend to run WebGL2; without
// these args the canvas init silently falls back to a no-op and screenshots
// capture only chrome over body bg. See docs/plans/2026-05-13-palette-registry-design.md.
const CHROMIUM_ARGS = [
  '--headless=new',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

// Per-theme bg in 0-255 RGB. Used as the "not yet rendered" sentinel by the
// readiness probe — we wait until the canvas contains pixels that differ
// from bg by ≥6/channel, proving WebGL actually drew something.
const BG_RGB = {
  'refined-grey': [26, 26, 26],
  'newsprint':    [244, 239, 230],
  'plum':         [30, 20, 41],
  'oxblood':      [28, 20, 16],
  'manuscript':   [242, 231, 200],
  'okabe':        [10, 16, 32],
};

const THEMES = ['refined-grey', 'newsprint', 'plum', 'oxblood', 'manuscript', 'okabe'];

// Keep STATES in sync with scripts/palette-assert.mjs.
// Hash fragments must include `overlay=<id>` for the URL state restorer to
// activate the overlay — see restoreOverlayFromUrl in src/main.ts: it early-
// returns if urlState.overlay is undefined, leaving all verses as plain dust.
const STATES = [
  { name: 'default',       query: '', hash: '' },
  { name: 'search-single', query: '', hash: 'overlay=search&q=Sinai' },
  { name: 'search-multi',  query: '', hash: 'overlay=search&q=Rebekah,plague,Sinai,menorah,holiness' },
  { name: 'commentary',    query: '', hash: 'overlay=commentary' },
  { name: 'trop',          query: '', hash: 'overlay=trop' },
  { name: 'text-dating',   query: '', hash: 'overlay=text-dating' },
  { name: 'haftarah',      query: '', hash: 'overlay=haftarah' },
  { name: 'verse-length',  query: '', hash: 'overlay=verse-length' },
];

const BASE = process.env.PROBE_URL ?? 'http://localhost:5173';
const OUT = resolve('docs/plans/data/palettes');

function buildUrl(theme, state) {
  const queryParts = ['theme=' + theme];
  if (state.query) queryParts.push(state.query);
  const queryString = queryParts.join('&');
  const hash = state.hash ? `#${state.hash}` : '';
  return `${BASE}/?${queryString}${hash}`;
}

// Wait until the WebGL canvas has drawn at least one verse (any pixel that's
// non-bg). Uses readPixels from inside an in-page evaluate so render+read
// happen in the same JS turn — robust against preserveDrawingBuffer:false.
//
// At default camera/zoom the Torah occupies only the top ~20% of the screen
// (PNG-y ≈ 50-250) because bounds (3331×1754) exceed viewport (1600×1000) and
// Genesis is parked near the top-right. readPixels uses bottom-left origin,
// so we sample at high WebGL-y (canvas.height - 100..250) to hit the verse band.
async function waitForRender(page, bgRgb, maxMs = 8000) {
  await page.waitForFunction(() => !!globalThis.torahMap, undefined, { timeout: maxMs });
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const result = await page.evaluate(() => {
      const tm = globalThis.torahMap;
      if (!tm) return { ok: false, reason: 'no torahMap' };
      tm.render();
      const gl = tm.canvas.getContext('webgl2');
      if (!gl) return { ok: false, reason: 'no webgl2 context' };
      const w = tm.canvas.width, h = tm.canvas.height;
      // Sample band: PNG-y ~ [80, 200] → WebGL-y = h - PNG-y ∈ [h-200, h-80].
      // Spread across x to avoid hitting only chrome or a label gap.
      const coords = [
        [(w*0.30)|0, h - 100], [(w*0.50)|0, h - 100], [(w*0.70)|0, h - 100],
        [(w*0.30)|0, h - 160], [(w*0.50)|0, h - 160], [(w*0.70)|0, h - 160],
      ];
      const samples = [];
      for (const [x, y] of coords) {
        const px = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        samples.push([px[0], px[1], px[2]]);
      }
      return { ok: true, samples };
    });
    if (!result.ok) return result;
    const drew = result.samples.some((s) =>
      Math.abs(s[0] - bgRgb[0]) > 6 || Math.abs(s[1] - bgRgb[1]) > 6 || Math.abs(s[2] - bgRgb[2]) > 6,
    );
    if (drew) return { ok: true };
    await page.waitForTimeout(150);
  }
  return { ok: false, reason: 'no non-bg pixels in verse band within timeout' };
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  // Suppress first-visit help modal — it occludes the canvas on every page load
  // since the harness uses a fresh browser context. Key from src/help.ts.
  await context.addInitScript(() => {
    try { localStorage.setItem('torahMap.helpSeen', 'true'); } catch {}
  });
  const page = await context.newPage();

  let saved = 0;
  let failures = 0;

  for (const theme of THEMES) {
    await mkdir(`${OUT}/${theme}`, { recursive: true });
    const bg = BG_RGB[theme];
    for (const state of STATES) {
      const url = buildUrl(theme, state);
      const outPath = `${OUT}/${theme}/${state.name}.png`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        const ready = await waitForRender(page, bg);
        if (!ready.ok) {
          console.error(`✗ ${theme}/${state.name}.png — readiness probe failed: ${ready.reason}`);
          failures++;
          continue;
        }
        await page.screenshot({ path: outPath });
        console.log(`✓ ${theme}/${state.name}.png`);
        saved++;
      } catch (e) {
        console.error(`✗ ${theme}/${state.name}.png — ${e.message}`);
        failures++;
      }
    }
  }

  await browser.close();
  console.log(`\npalette:verify — ${saved} screenshots saved, ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Browser launch failed:', e);
  process.exit(1);
});
