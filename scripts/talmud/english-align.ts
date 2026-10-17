#!/usr/bin/env tsx
// Download the William Davidson English for every tractate and check it lines up with the map's
// segments: the same amudim, the same segment count in each, and its MISHNA/GEMARA labels on the
// segments where the Hebrew's מתני׳/גמ׳ fall. Prints each disagreement; changes nothing shipped.
//
//   npx tsx scripts/talmud/english-align.ts

import { access, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BAVLI_TRACTATES, CACHE_ROOT } from './verify-coverage.ts';
import { markersOf } from './markers.ts';

const SEFARIA_EXPORT = readFileSync('scripts/sefaria-export.env', 'utf-8').match(
  /^SEFARIA_EXPORT=(.+)$/m,
)?.[1];
const VERSION = 'William Davidson Edition - English.json';

/** Where a tractate's English is cached; ENGLISH_DIR moves it out of data/. */
export const englishPath = (tractate: string): string =>
  process.env.ENGLISH_DIR
    ? join(process.env.ENGLISH_DIR, `${tractate}.json`)
    : join(CACHE_ROOT, tractate, 'english.json');

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function readEnglish(seder: string, tractate: string): Promise<string[][]> {
  const path = englishPath(tractate);
  if (!(await exists(path))) {
    const url = `${SEFARIA_EXPORT}/json/Talmud/Bavli/${encodeURIComponent(`Seder ${seder}`)}/${encodeURIComponent(tractate)}/English/${encodeURIComponent(VERSION)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    await writeFile(path, await res.text(), 'utf-8');
  }
  return (JSON.parse(await readFile(path, 'utf-8')) as { text: string[][] }).text;
}

export async function readHebrew(tractate: string, file: string): Promise<string[][]> {
  const json = JSON.parse(await readFile(join(CACHE_ROOT, tractate, file), 'utf-8'));
  return (json as { text: string[][] }).text;
}

const HADRAN = /^\s*(?:<[^>]+>\s*)*הדרן/;
// The English labels a part "<strong>MISHNA:</strong>" mostly, but also MISHNAH, bare, or "gemara".
const LABEL = /(?:<strong>\s*|^\s*)(MISHNAH?|GEMARA|gemara)\b/;

async function main(): Promise<void> {
  let segments = 0;
  let hadran = 0;
  const problems: string[] = [];
  for (const { seder, tractate } of BAVLI_TRACTATES) {
    const english = await readEnglish(seder, tractate);
    const hebrew = await readHebrew(tractate, 'wikisource.json');
    const markers = markersOf(hebrew, await readHebrew(tractate, 'merged.json'));
    const place = (ai: number, si: number) =>
      `${tractate} ${1 + Math.floor(ai / 2)}${ai % 2 ? 'b' : 'a'}:${si + 1}`;
    if (english.length !== hebrew.length) {
      problems.push(`${tractate}: ${english.length} amudim in English, ${hebrew.length} in Hebrew`);
    }
    let labels = 0;
    for (let ai = 0; ai < hebrew.length; ai++) {
      const he = hebrew[ai];
      const en = english[ai] ?? [];
      if (en.length !== he.length) {
        problems.push(`${place(ai, 0)}: ${en.length} English segments, ${he.length} Hebrew`);
      }
      for (let si = 0; si < he.length; si++) {
        segments++;
        const e = en[si] ?? '';
        if (e.trim() === '') {
          if (HADRAN.test(he[si])) hadran++;
          else problems.push(`${place(ai, si)}: no English for "${he[si].slice(0, 60)}"`);
          continue;
        }
        const label = e.match(LABEL)?.[1].toUpperCase().replace('MISHNAH', 'MISHNA');
        const opens = markers[ai][si].opens;
        const want = opens === 'M' ? 'MISHNA' : opens === 'G' ? 'GEMARA' : undefined;
        if (label && label === want) labels++;
        else if (label !== want) {
          problems.push(`${place(ai, si)}: English ${label ?? '-'}, Hebrew ${want ?? '-'}`);
        }
      }
    }
    console.log(`${tractate.padEnd(14)} ${labels} MISHNA/GEMARA labels agree`);
  }
  console.log(`\n${segments} segments; ${hadran} Hadran lines with no English`);
  console.log(`${problems.length} disagreements:`);
  for (const p of problems) console.log(`  ${p}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
