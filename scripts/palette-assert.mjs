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

// Theme expectations — derived from src/themes.ts THEMES records, converted to
// 0-255 RGB for pixel comparison. Keep in sync with that file.
const THEME_EXPECTATIONS = {
  'refined-grey': { bg: [26, 26, 26],    dustMin: 0.50, dustMax: 0.92, dim: 0.30, tint: null },
  'newsprint':    { bg: [244, 239, 230], dustMin: 0.10, dustMax: 0.42, dim: 0.78, tint: [0.20, 0.16, 0.12] },
  'plum':         { bg: [30, 20, 41],    dustMin: 0.62, dustMax: 0.95, dim: 0.40, tint: [1.00, 0.95, 0.85] },
  'oxblood':      { bg: [28, 20, 16],    dustMin: 0.30, dustMax: 0.88, dim: 0.32, tint: [1.00, 0.55, 0.45] },
  'manuscript':   { bg: [242, 231, 200], dustMin: 0.18, dustMax: 0.50, dim: 0.72, tint: [0.55, 0.45, 0.30] },
  'okabe':        { bg: [10, 16, 32],    dustMin: 0.45, dustMax: 0.88, dim: 0.42, tint: [0.62, 0.68, 0.85] },
};

// Each state's `hash` becomes the URL hash fragment.
// Empty hash = no overlay (default dust view).
const STATES = [
  { name: 'default',       hash: '' },
  { name: 'search-single', hash: 'q=Sinai' },
  { name: 'search-multi',  hash: 'q=Rebekah,plague,Sinai,menorah,holiness' },
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

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--headless=new'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

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
      // Give the WebGL canvas a beat to render after networkidle fires.
      await page.waitForTimeout(700);

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
        } else {
          skipped++;
        }
        // Future: handlers for 'dust-*', 'sinai-match', 'non-match-*' etc.
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
