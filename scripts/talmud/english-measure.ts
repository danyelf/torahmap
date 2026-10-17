#!/usr/bin/env tsx
// Measure the ways English search could ship: the download each costs, gzipped and in brotli, and
// how fast a query runs on it. Reads the English english-align.ts downloads; writes the candidate
// files to MEASURE_DIR (default data/talmud/raw/english-measure/, gitignored) and a table to stdout.
//
//   npx tsx scripts/talmud/english-measure.ts

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
// The search package's index entry pulls in its stylesheet, which Node cannot load.
import {
  buildTextIndex,
  itemsForTerm,
  type SearchEntry,
} from '../../packages/search/src/textIndex.ts';
import { english } from '../../packages/search/src/english.ts';
import { BAVLI_TRACTATES, CACHE_ROOT } from './verify-coverage.ts';
import { readEnglish, readHebrew } from './english-align.ts';

const OUT = process.env.MEASURE_DIR ?? join(CACHE_ROOT, 'english-measure');

/** A segment as the popup would get it: plain text, and the stretches of it in bold. */
export interface Runs {
  text: string;
  bold: [number, number][];
}

// <b> is the literal translation; <strong> the MISHNA/GEMARA labels; six spans in Berakhot mark
// translation the same way. <i> (transliterations) is dropped here, so only bold is measured.
const BOLD_OPEN = /^<(b|strong|span class="gemarra-regular")>$/;
const BOLD_CLOSE = /^<\/(b|strong|span)>$/;

let unbalanced = 0;

export function toRuns(html: string): Runs {
  let text = '';
  const bold: [number, number][] = [];
  let depth = 0;
  let from = 0;
  for (const piece of html.split(/(<[^>]*>)/)) {
    if (!piece.startsWith('<')) {
      text += piece;
      continue;
    }
    if (/^<br\s*\/?>$/.test(piece)) text += ' ';
    else if (BOLD_OPEN.test(piece)) {
      if (depth++ === 0) from = text.length;
    } else if (BOLD_CLOSE.test(piece) && depth > 0) {
      if (--depth === 0) bold.push([from, text.length]);
    }
  }
  if (depth > 0) {
    unbalanced++;
    bold.push([from, text.length]);
  }
  // Collapse spaces, moving the bold edges with the text.
  const keep: number[] = [];
  let out = '';
  for (let i = 0; i < text.length; i++) {
    keep.push(out.length);
    if (/\s/.test(text[i]) && (out.length === 0 || out.endsWith(' '))) continue;
    out += /\s/.test(text[i]) ? ' ' : text[i];
  }
  keep.push(out.length);
  const trimmed = out.trimEnd();
  const at = (i: number) => Math.min(keep[i], trimmed.length);
  return {
    text: trimmed,
    bold: bold.map(([s, e]): [number, number] => [at(s), at(e)]).filter(([s, e]) => e > s),
  };
}

const kb = (n: number) => `${(n / 1e6).toFixed(2)} MB`;

function sizes(name: string, data: string | Buffer): string[] {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  const gz = gzipSync(buf, { level: 9 }).length;
  const br = brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  }).length;
  return [name, kb(buf.length), kb(gz), kb(br)];
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function time(f: () => unknown, runs = 5): number {
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    f();
    ms.push(performance.now() - t);
  }
  return median(ms);
}

const WORD = /[\p{L}\p{N}]+/gu;
const words = (text: string) => text.toLowerCase().match(WORD) ?? [];

function varint(n: number, out: number[]): void {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}

/** Each word, then its segments' ordinals as a count and gaps, all varints. */
function encodeIndex(postings: Map<string, number[]>, dropped: Set<string>): Buffer {
  const bytes: number[] = [];
  const vocab = [...postings.keys()].filter((w) => !dropped.has(w)).sort();
  for (const w of vocab) {
    bytes.push(...Buffer.from(w), 0);
    const ids = postings.get(w)!;
    varint(ids.length, bytes);
    let last = -1;
    for (const id of ids) {
      varint(id - last - 1, bytes);
      last = id;
    }
  }
  return Buffer.from(bytes);
}

function decodeIndex(buf: Buffer): Map<string, Uint32Array> {
  const index = new Map<string, Uint32Array>();
  let p = 0;
  const read = () => {
    let n = 0;
    let shift = 0;
    for (;;) {
      const b = buf[p++];
      n += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return n;
      shift += 7;
    }
  };
  while (p < buf.length) {
    const end = buf.indexOf(0, p);
    const w = buf.toString('utf8', p, end);
    p = end + 1;
    const ids = new Uint32Array(read());
    let last = -1;
    for (let i = 0; i < ids.length; i++) ids[i] = last = last + 1 + read();
    index.set(w, ids);
  }
  return index;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const full: Record<string, string[][]> = {};
  const boldOnly: Record<string, string[][]> = {};
  const runsByTractate: Record<string, Runs[][]> = {};
  const segments: { id: string; runs: Runs }[] = [];
  let boldChars = 0;
  let allChars = 0;
  let italics = 0;

  for (const { seder, tractate } of BAVLI_TRACTATES) {
    const hebrew = await readHebrew(tractate, 'wikisource.json');
    const skip = hebrew.findIndex((amud) => amud.length > 0);
    const english = (await readEnglish(seder, tractate)).slice(skip);
    const amudim = hebrew.slice(skip).map((he, ai) =>
      he.map((_, si) => {
        const html = english[ai]?.[si] ?? '';
        italics += (html.match(/<i>/g) ?? []).length;
        return toRuns(html);
      }),
    );
    runsByTractate[tractate] = amudim;
    full[tractate] = amudim.map((a) => a.map((r) => r.text));
    boldOnly[tractate] = amudim.map((a) =>
      a.map((r) => r.bold.map(([s, e]) => r.text.slice(s, e).trim()).join(' ')),
    );
    for (const [ai, amud] of amudim.entries()) {
      for (const [si, runs] of amud.entries()) {
        segments.push({ id: `${tractate}:${ai}:${si}`, runs });
        allChars += runs.text.length;
        for (const [s, e] of runs.bold) boldChars += e - s;
      }
    }
  }
  console.log(`${segments.length} segments, ${kb(allChars)} of text characters`);
  console.log(`bold: ${((100 * boldChars) / allChars).toFixed(1)}% of characters`);
  console.log(`segments with an unclosed bold tag: ${unbalanced}; <i> tags dropped: ${italics}`);

  const rows: string[][] = [['file', 'raw', 'gzip -9', 'brotli 11']];
  const fullJson = JSON.stringify(full);
  const boldJson = JSON.stringify(boldOnly);
  await writeFile(join(OUT, 'full.json'), fullJson);
  await writeFile(join(OUT, 'bold.json'), boldJson);
  rows.push(sizes('a. full text, one file', fullJson));
  rows.push(sizes('b. bold only, one file', boldJson));

  // The popup's English, one file per tractate, in two shapes: the text with its bold stretches'
  // offsets, or the text cut into strings that are plain and bold by turns.
  const alternating = (r: Runs): string[] => {
    const out: string[] = [];
    let at = 0;
    for (const [s, e] of r.bold) {
      out.push(r.text.slice(at, s), r.text.slice(s, e));
      at = e;
    }
    if (at < r.text.length) out.push(r.text.slice(at));
    return out;
  };
  for (const [label, shape] of [
    ['offsets', (r: Runs) => [r.text, r.bold.flat()]],
    ['alternating strings', alternating],
  ] as const) {
    let raw = 0;
    let gz = 0;
    let biggest = ['', 0] as [string, number];
    for (const [tractate, amudim] of Object.entries(runsByTractate)) {
      const json = Buffer.from(JSON.stringify(amudim.map((a) => a.map(shape))));
      const size = gzipSync(json, { level: 9 }).length;
      raw += json.length;
      gz += size;
      if (size > biggest[1]) biggest = [tractate, size];
    }
    rows.push([`popup English as ${label}, 37 files`, kb(raw), kb(gz), '']);
    console.log(`popup as ${label}: biggest is ${biggest[0]}, ${kb(biggest[1])} gzipped`);
  }

  // The word index over the full text, and over the bold only.
  const postingsOf = (text: (r: Runs) => string) => {
    const postings = new Map<string, number[]>();
    segments.forEach(({ runs }, n) => {
      for (const w of new Set(words(text(runs)))) {
        let ids = postings.get(w);
        if (!ids) postings.set(w, (ids = []));
        ids.push(n);
      }
    });
    return postings;
  };
  const postings = postingsOf((r) => r.text);
  const byFrequency = [...postings.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`\nvocabulary: ${postings.size} words; the commonest, by share of segments:`);
  console.log(
    byFrequency
      .slice(0, 100)
      .map(([w, ids]) => `${w} ${Math.round((100 * ids.length) / segments.length)}%`)
      .join(', '),
  );
  const singletons = byFrequency.filter(([, ids]) => ids.length === 1).length;
  console.log(`words in one segment only: ${singletons}`);
  for (const drop of [0, 50, 100, 200, 500]) {
    const dropped = new Set(byFrequency.slice(0, drop).map(([w]) => w));
    const cut = drop ? byFrequency[drop - 1][1].length / segments.length : 1;
    const buf = encodeIndex(postings, dropped);
    if (drop === 100) await writeFile(join(OUT, 'index-100.bin'), buf);
    rows.push(sizes(`c. word index, top ${drop} dropped (in ≥${(100 * cut).toFixed(0)}%)`, buf));
  }
  const boldPostings = postingsOf((r) => r.bold.map(([s, e]) => r.text.slice(s, e)).join(' '));
  const boldByFrequency = [...boldPostings.entries()].sort((a, b) => b[1].length - a[1].length);
  rows.push(
    sizes(
      'c. word index of bold only, top 100 dropped',
      encodeIndex(boldPostings, new Set(boldByFrequency.slice(0, 100).map(([w]) => w))),
    ),
  );
  // Every pair of neighbouring words, which a two-word phrase can be checked against.
  const pairs = new Map<string, number[]>();
  segments.forEach(({ runs }, n) => {
    const ws = words(runs.text);
    const seen = new Set<string>();
    for (let i = 1; i < ws.length; i++) seen.add(`${ws[i - 1]} ${ws[i]}`);
    for (const p of seen) {
      let ids = pairs.get(p);
      if (!ids) pairs.set(p, (ids = []));
      ids.push(n);
    }
  });
  rows.push(sizes(`c. index of word pairs (${pairs.size} pairs)`, encodeIndex(pairs, new Set())));

  console.log('');
  for (const r of rows) console.log(r.map((c, i) => (i ? c.padStart(10) : c.padEnd(48))).join(''));

  // Query speed on the full text and bold text, through the search package's own index.
  const queries: [string, 'word' | 'substring'][] = [
    ['shema', 'word'],
    ['rabbi yoḥanan', 'word'],
    ['the', 'word'],
    ['bless', 'substring'],
    ['ox that gored', 'word'],
  ];
  const timed = (label: string, texts: Record<string, string[][]>) => {
    const entries: SearchEntry[] = [];
    for (const [tractate, amudim] of Object.entries(texts)) {
      amudim.forEach((a, ai) =>
        a.forEach((en, si) =>
          entries.push({ id: `${tractate}:${ai}:${si}`, ref: '', text: { en } }),
        ),
      );
    }
    let index!: ReturnType<typeof buildTextIndex>;
    const parse = time(() => JSON.parse(JSON.stringify(texts)), 3);
    const build = time(() => (index = buildTextIndex(entries, [english])), 3);
    console.log(
      `\n${label}: JSON.parse ${parse.toFixed(0)} ms, index build ${build.toFixed(0)} ms`,
    );
    for (const [q, mode] of queries) {
      let hits = 0;
      const ms = time(() => (hits = itemsForTerm(index, q, english, mode).size));
      console.log(`  "${q}" ${mode}: ${ms.toFixed(0)} ms, ${hits} segments`);
    }
  };
  timed('a. full text', full);
  timed('b. bold only', boldOnly);

  // Word index: load, then a word, and a phrase as the segments holding all its words.
  const indexBuf = encodeIndex(postings, new Set(byFrequency.slice(0, 100).map(([w]) => w)));
  let index!: Map<string, Uint32Array>;
  console.log(
    `\nc. word index (top 100 dropped): decode ${time(() => (index = decodeIndex(indexBuf)), 3).toFixed(0)} ms`,
  );
  const intersect = (ws: string[]) => {
    const lists = ws.map((w) => index.get(w)).filter((l): l is Uint32Array => !!l);
    if (lists.length === 0) return [];
    let acc = [...lists[0]];
    for (const l of lists.slice(1)) {
      const s = new Set(l);
      acc = acc.filter((x) => s.has(x));
    }
    return acc;
  };
  for (const [q] of queries) {
    let n = 0;
    const ms = time(() => (n = intersect(words(q)).length));
    const truly = segments.filter(({ runs }) =>
      new RegExp(`\\b${q}\\b`).test(runs.text.toLowerCase()),
    ).length;
    console.log(
      `  "${q}": ${ms.toFixed(2)} ms, ${n} segments hold every word; ${truly} hold the phrase`,
    );
  }
  const vocab = [...index.keys()];
  let sub = 0;
  const subMs = time(() => {
    const ids = new Set<number>();
    for (const w of vocab) if (w.includes('bless')) for (const id of index.get(w)!) ids.add(id);
    sub = ids.size;
  });
  console.log(`  "bless" inside any indexed word: ${subMs.toFixed(0)} ms, ${sub} segments`);

  // SQLite full-text search, as D1 would hold it.
  const dbPath = join(OUT, 'fts.sqlite');
  await writeFile(dbPath, '');
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=OFF; CREATE VIRTUAL TABLE seg USING fts5(id UNINDEXED, en);`);
  const insert = db.prepare('INSERT INTO seg (id, en) VALUES (?, ?)');
  db.exec('BEGIN');
  for (const { id, runs } of segments) insert.run(id, runs.text);
  db.exec('COMMIT');
  db.exec(`INSERT INTO seg(seg) VALUES('optimize'); VACUUM;`);
  const ftsQueries = ['shema', '"rabbi yoḥanan"', 'the', 'bless*', '"ox that gored"'];
  console.log('\nd. SQLite FTS5 (local file, no network):');
  for (const q of ftsQueries) {
    const stmt = db.prepare('SELECT id FROM seg WHERE seg MATCH ?');
    let n = 0;
    const ms = time(() => (n = stmt.all(q).length));
    console.log(`  ${q}: ${ms.toFixed(1)} ms, ${n} segments`);
  }
  db.close();
  const { statSync } = await import('node:fs');
  console.log(`  database file: ${kb(statSync(dbPath).size)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
