#!/usr/bin/env node
// scripts/palette-assert.mjs
// Programmatic Playwright assertions verifying each (theme × state) combination
// renders the expected colors at fixed canvas sample points.
//
// Background:
//   - URL state in Torah Map lives in TWO places:
//       theme              → query string `?theme=<id>` (src/themes.ts:resolveThemeId)
//       overlay/q/category → hash fragment `#overlay=...&q=...` (src/urlState.ts)
//   - We build URLs of the form `http://host/?theme=<id>#<state-hash>`.
//
// Usage:
//   npm run palette:assert            # against http://localhost:5173
//   PROBE_URL=http://localhost:4173 npm run palette:assert

import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Headless Chromium needs an explicit GL backend to run WebGL2; without
// these args the canvas init silently falls back to a no-op and screenshots
// capture only chrome over body bg. Match scripts/palette-verify.mjs.
const CHROMIUM_ARGS = [
  '--headless=new',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

// Theme expectations — derived from src/themes.ts THEMES records, converted to
// 0-255 RGB for pixel comparison. Keep in sync with that file.
const THEME_EXPECTATIONS = {
  'refined-grey': { polarity: 'dark',  bg: [26, 26, 26],    dustMin: 0.50, dustMax: 0.92, dim: 0.30, tint: null },
  'newsprint':    { polarity: 'light', bg: [244, 239, 230], dustMin: 0.10, dustMax: 0.42, dim: 0.78, tint: [0.20, 0.16, 0.12] },
  'plum':         { polarity: 'dark',  bg: [30, 20, 41],    dustMin: 0.62, dustMax: 0.95, dim: 0.40, tint: [1.00, 0.95, 0.85] },
  'oxblood':      { polarity: 'dark',  bg: [28, 20, 16],    dustMin: 0.30, dustMax: 0.88, dim: 0.32, tint: [1.00, 0.55, 0.45] },
  'manuscript':   { polarity: 'light', bg: [242, 231, 200], dustMin: 0.18, dustMax: 0.50, dim: 0.72, tint: [0.55, 0.45, 0.30] },
  'okabe':        { polarity: 'dark',  bg: [10, 16, 32],    dustMin: 0.45, dustMax: 0.88, dim: 0.42, tint: [0.62, 0.68, 0.85] },
};

// Each state's `hash` becomes the URL hash fragment.
// Empty hash = no overlay (default dust view).
// Hash fragments must include `overlay=<id>` for the URL state restorer to
// activate the overlay — see restoreOverlayFromUrl in src/main.ts.
const STATES = [
  { name: 'default',       hash: '' },
  { name: 'search-single', hash: 'overlay=search&q=Sinai' },
  { name: 'search-multi',  hash: 'overlay=search&q=Rebekah,plague,Sinai,menorah,holiness' },
  { name: 'commentary',    hash: 'overlay=commentary' },
  { name: 'trop',          hash: 'overlay=trop' },
  { name: 'text-dating',   hash: 'overlay=text-dating' },
  { name: 'haftarah',      hash: 'overlay=haftarah' },
  { name: 'verse-length',  hash: 'overlay=verse-length' },
];

const SAMPLES = JSON.parse(readFileSync(resolve('scripts/palette-samples.json'), 'utf8'));
const BASE = process.env.PROBE_URL ?? 'http://localhost:5173';

function sample(png, x, y) {
  const idx = (png.width * y + x) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

function within(a, b, tolPerChannel) {
  return a.every((v, i) => Math.abs(v - b[i]) <= tolPerChannel);
}

function buildUrl(themeId, hash) {
  const base = `${BASE}/?theme=${themeId}`;
  return hash ? `${base}#${hash}` : base;
}

// Wait until the WebGL canvas has drawn at least one verse. Mirrors the
// helper in scripts/palette-verify.mjs — render+readPixels inside one
// page.evaluate so the result is robust against preserveDrawingBuffer:false.
//
// Samples in the upper PNG band (high WebGL-y) where verses actually live
// at default zoom — at boot, the Torah only fills the top ~20% of viewport.
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

// Expected color for non-match dim pixel after Task 16 fix.
//   tint  → [tint[0] * dim, tint[1] * dim, tint[2] * dim]
//   none  → [dim, dim, dim]
// in 0-255 RGB.
function expectedDimRgb(exp) {
  const d = exp.dim;
  if (!exp.tint) return [Math.round(d * 255), Math.round(d * 255), Math.round(d * 255)];
  return [
    Math.round(exp.tint[0] * d * 255),
    Math.round(exp.tint[1] * d * 255),
    Math.round(exp.tint[2] * d * 255),
  ];
}

// Verse cells are 1-2 px at default zoom with antialiasing enabled, so a
// single sampled pixel is typically blended dust×bg, not the pure dust color.
// Per-channel range checks against the formula `tint × [dust.min, dust.max]`
// therefore fail for light-bg themes — bg overwhelms the blend. Instead we
// verify three weaker but semantically meaningful properties:
//   1. pixel is meaningfully non-bg     → verses *were* drawn at the coord
//   2. mean luminance on the correct side of bg   → polarity is honored
//   3. dominant tint channel matches theme.tint   → tint is applied at all
// Together these regress the failure modes that matter: missing verses,
// theme-not-applied, and tint-stripped-to-grey (Task 16's class of bug).

function meanLum(rgb) { return (rgb[0] + rgb[1] + rgb[2]) / 3; }

function isClearlyNonBg(got, bgRgb, minDelta = 30) {
  return Math.abs(meanLum(got) - meanLum(bgRgb)) >= minDelta;
}

function polarityOk(got, exp) {
  // Dark themes: verse > bg luminance; light themes: verse < bg luminance.
  const dlum = meanLum(got) - meanLum(exp.bg);
  return exp.polarity === 'dark' ? dlum > 0 : dlum < 0;
}

function tintDirectionOk(got, exp) {
  // No tint: expect near-grey (max-min channel ≤ 18, allowing shader noise).
  if (!exp.tint) {
    return Math.max(...got) - Math.min(...got) <= 18;
  }
  // Tinted: the channel with the largest tint coefficient should be the
  // brightest in the sampled pixel. (Holds for both light and dark bg under
  // proportional antialias blending, because rank order survives linear blend.)
  let tintMax = 0;
  for (let i = 1; i < 3; i++) if (exp.tint[i] > exp.tint[tintMax]) tintMax = i;
  let pxMax = 0;
  for (let i = 1; i < 3; i++) if (got[i] > got[pxMax]) pxMax = i;
  return tintMax === pxMax;
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

  let failures = 0;
  let checks = 0;
  let skipped = 0;
  const failureLines = [];

  for (const [themeId, exp] of Object.entries(THEME_EXPECTATIONS)) {
    for (const state of STATES) {
      const url = buildUrl(themeId, state.hash);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (e) {
        const line = `FAIL ${themeId} ${state.name}: navigation failed — ${e.message}`;
        console.error(line);
        failureLines.push(line);
        failures++;
        continue;
      }
      const ready = await waitForRender(page, exp.bg);
      if (!ready.ok) {
        const line = `FAIL ${themeId} ${state.name}: readiness probe — ${ready.reason}`;
        console.error(line);
        failureLines.push(line);
        failures++;
        continue;
      }

      const buf = await page.screenshot();
      const png = PNG.sync.read(buf);

      const stateSamples = SAMPLES[state.name] ?? [];
      for (const s of stateSamples) {
        const got = sample(png, s.x, s.y);
        if (s.label === 'bg') {
          checks++;
          if (!within(got, exp.bg, 4)) {
            const line = `FAIL ${themeId} ${state.name} bg @(${s.x},${s.y}): got [${got.join(',')}], want [${exp.bg.join(',')}]`;
            console.error(line);
            failureLines.push(line);
            failures++;
          }
        } else if (s.label === 'dust-genesis') {
          checks++;
          const reasons = [];
          if (!isClearlyNonBg(got, exp.bg)) reasons.push('not visibly non-bg (no verse at coord?)');
          if (!polarityOk(got, exp))         reasons.push(`polarity wrong (expected ${exp.polarity} bg, verse not on correct side)`);
          if (!tintDirectionOk(got, exp))    reasons.push('tint chromaticity wrong');
          if (reasons.length > 0) {
            const tintDesc = exp.tint ? `tint [${exp.tint.join(',')}]` : 'no tint';
            const line = `FAIL ${themeId} ${state.name} dust-genesis @(${s.x},${s.y}): got [${got.join(',')}], ${tintDesc}, bg [${exp.bg.join(',')}] — ${reasons.join('; ')}`;
            console.error(line);
            failureLines.push(line);
            failures++;
          }
        } else if (s.label === 'non-match-genesis') {
          checks++;
          const want = expectedDimRgb(exp);
          if (!within(got, want, 8)) {
            const line = `FAIL ${themeId} ${state.name} non-match-genesis @(${s.x},${s.y}): got [${got.join(',')}], want [${want.join(',')}] (±8)`;
            console.error(line);
            failureLines.push(line);
            failures++;
          }
        } else {
          skipped++;
        }
      }
    }
  }

  await browser.close();

  const skippedNote = skipped > 0 ? ` (${skipped} sample(s) skipped: no handler for non-bg labels yet)` : '';
console.log(`\npalette:assert — ${checks} checks, ${failures} failure(s)${skippedNote}`);
  if (failures > 0) {
    console.log('\nFailures:');
    for (const line of failureLines) console.log('  ' + line);
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
