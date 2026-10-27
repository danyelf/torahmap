/**
 * How many echo pairs the Tanakh holds for each length of run and cut-off for a run that recurs
 * too often, what the file weighs, and which famous parallels they find.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/echoes-report.ts
 */

import { gzipSync } from 'node:zlib';
import { readBooks } from './generate.ts';
import { MAX_VERSES_PER_RUN, echoesAnywhere } from './echoes.ts';
import type { EchoesFile } from '@torahmap/tanakh/overlays/text-analytics/echoes.ts';

const { books, refs } = readBooks();

const where: { book: string; chapter: number }[] = books.flatMap(({ name }, b) =>
  refs[b].map(([chapter]) => ({ book: name, chapter: Number(chapter) })),
);

type Range = [book: string, from: number, to: number];
const inside = (p: number, [book, from, to]: Range) =>
  where[p].book === book && where[p].chapter >= from && where[p].chapter <= to;
const samuelKings: Range[] = ['I Samuel', 'II Samuel', 'I Kings', 'II Kings'].map((b) => [
  b,
  1,
  99,
]);
const chronicles: Range[] = ['I Chronicles', 'II Chronicles'].map((b) => [b, 1, 99]);
const parallels: [label: string, from: Range[], to: Range[]][] = [
  ['Ps 14>53', [['Psalms', 14, 14]], [['Psalms', 53, 53]]],
  ['Ps 60>108', [['Psalms', 60, 60]], [['Psalms', 108, 108]]],
  [
    'Ps 108>60,57',
    [['Psalms', 108, 108]],
    [
      ['Psalms', 60, 60],
      ['Psalms', 57, 57],
    ],
  ],
  ['Ex 25-31>35-40', [['Exodus', 25, 31]], [['Exodus', 35, 40]]],
  ['Ex 35-40>25-31', [['Exodus', 35, 40]], [['Exodus', 25, 31]]],
  ['2 Sam 22>Ps 18', [['II Samuel', 22, 22]], [['Psalms', 18, 18]]],
  ['Isa 36-39>2 Ki 18-20', [['Isaiah', 36, 39]], [['II Kings', 18, 20]]],
  ['Num 7>7', [['Numbers', 7, 7]], [['Numbers', 7, 7]]],
  ['Chr>Sam/Ki', chronicles, samuelKings],
  ['Sam/Ki>Chr', samuelKings, chronicles],
];

console.log(`Cut-off shipped: runs in more than ${MAX_VERSES_PER_RUN} verses are set aside\n`);

const cutoffs = [Infinity, 30, 20, MAX_VERSES_PER_RUN, 12, 10];
for (const cutoff of cutoffs) {
  const echoes = echoesAnywhere(books, cutoff);
  console.log(`Cut-off ${cutoff}`);
  for (const minWords of [5, 6, 8]) {
    const pairs = echoes.reduce(
      (n, others, a) => n + others.filter(([b, words]) => a < b && words >= minWords).length,
      0,
    );
    const most = Math.max(...echoes.map((o) => o.filter(([, w]) => w >= minWords).length));
    const found = parallels.map(([label, from, to]) => {
      let total = 0;
      let hit = 0;
      echoes.forEach((others, p) => {
        if (!from.some((r) => inside(p, r))) return;
        total++;
        if (others.some(([o, w]) => w >= minWords && to.some((r) => inside(o, r)))) hit++;
      });
      return `${label} ${hit}/${total}`;
    });
    console.log(`  ${minWords}+ words: ${pairs} pairs, most echoes on one verse ${most}`);
    console.log(`    ${found.join(' | ')}`);
  }
}

const echoes = echoesAnywhere(books);
const file: EchoesFile = {};
echoes.forEach((others, v) => {
  const later = others.filter(([o]) => o > v).flat();
  if (later.length) file[v] = later;
});
const json = JSON.stringify(file);
console.log(
  `\nFile: ${(json.length / 1024).toFixed(0)} KB, ${(gzipSync(json).length / 1024).toFixed(0)} KB gzipped`,
);
let betweenBooks = 0;
let pairs = 0;
const bookPairs = new Map<string, number>();
echoes.forEach((others, a) =>
  others.forEach(([b, words]) => {
    if (a >= b || words < 5) return;
    pairs++;
    if (where[a].book === where[b].book) return;
    betweenBooks++;
    const key = [where[a].book, where[b].book].sort().join(' / ');
    bookPairs.set(key, (bookPairs.get(key) ?? 0) + 1);
  }),
);
console.log(`At 5 words: ${pairs} pairs, ${betweenBooks} between books`);
console.log(
  `Most pairs between books: ${[...bookPairs]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, n]) => `${k} ${n}`)
    .join('; ')}`,
);
