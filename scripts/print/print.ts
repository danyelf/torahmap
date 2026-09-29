// Writes the wall prints: npm run print [-- --marks]. Output goes to
// scripts/print/out/, as SVG (for Figma), vector PDF, and 300 dpi PNG.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { draw } from './draw.ts';
import { FACES, FONT_HEAD, unloadedFaces } from './fonts.ts';
import type { DrawResult, ProofInput, SheetInput } from './types.ts';
import { haftarahSheet, loadStructure, proofInput, searchSheet } from './views.ts';

const OUT = 'scripts/print/out';

// The site's loaders fetch from the site root; serve public/ from disk, as
// scripts/search/click-resolution-report.ts does.
const publicDir = normalize('public');
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = normalize(
    join(publicDir, decodeURIComponent(url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0])),
  );
  if (!path.startsWith(publicDir) || !existsSync(path)) {
    return new Response(null, { status: 404 });
  }
  return new Response(readFileSync(path, 'utf8'), { status: 200 });
}) as typeof fetch;

async function openPage(): Promise<Page> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    ${FONT_HEAD}<style>@page { margin: 0 } body { margin: 0 }</style>
    </head><body></body></html>`);
  const loaded = await page.evaluate(async (faces) => {
    await Promise.all(
      faces.map((f) => document.fonts.load(`${f.weight} 20px "${f.family}"`, 'אבג abc')),
    );
    return [...document.fonts].map((f) => ({
      family: f.family,
      weight: f.weight,
      status: f.status,
    }));
  }, FACES);
  const missing = unloadedFaces(FACES, loaded);
  if (missing.length) {
    const names = missing.map((f) => `${f.family} ${f.weight}`).join(', ');
    throw new Error(`These fonts did not load: ${names}`);
  }
  return page;
}

async function write(
  page: Page,
  name: string,
  input: SheetInput | ProofInput,
): Promise<DrawResult> {
  const result = await page.evaluate(draw, input);
  for (const entry of result.overflows) {
    console.warn(`${name}: key entry wider than its column: ${entry}`);
  }
  writeFileSync(
    join(OUT, `${name}.svg`),
    `<?xml version="1.0" encoding="UTF-8"?>\n${result.svg}\n`,
  );
  await page.pdf({
    path: join(OUT, `${name}.pdf`),
    width: `${result.width / 72}in`,
    height: `${result.height / 72}in`,
    printBackground: true,
  });
  execFileSync('pdftoppm', [
    '-r',
    '300',
    '-png',
    '-singlefile',
    join(OUT, `${name}.pdf`),
    join(OUT, name),
  ]);
  console.log(`${name}: ${(result.width / 72).toFixed(3)} × ${(result.height / 72).toFixed(3)} in`);
  return result;
}

const marks = process.argv.includes('--marks');
mkdirSync(OUT, { recursive: true });
const structure = loadStructure();
const page = await openPage();
try {
  const haftarah = await haftarahSheet(structure, marks);
  const search = await searchSheet(structure, marks);
  const drawn = await write(page, 'haftarah', haftarah);
  await write(page, 'search', search);
  await write(page, 'proof', proofInput(haftarah, search, drawn.scale));
} finally {
  await page.context().browser()?.close();
}
