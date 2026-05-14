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

const THEMES = ['refined-grey', 'newsprint', 'plum', 'oxblood', 'manuscript', 'okabe'];

// Keep STATES in sync with scripts/palette-assert.mjs.
const STATES = [
  { name: 'default',       query: '', hash: '' },
  { name: 'search-single', query: '', hash: 'q=Sinai' },
  { name: 'search-multi',  query: '', hash: 'q=Rebekah,plague,Sinai,menorah,holiness' },
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

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  let saved = 0;
  let failures = 0;

  for (const theme of THEMES) {
    await mkdir(`${OUT}/${theme}`, { recursive: true });
    for (const state of STATES) {
      const url = buildUrl(theme, state);
      const outPath = `${OUT}/${theme}/${state.name}.png`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(700);
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
