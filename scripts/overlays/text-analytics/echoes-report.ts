/**
 * How many echo pairs the Tanakh holds, how they spread across books, what the file weighs, and
 * which famous parallels they find.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/echoes-report.ts
 */

import { gzipSync } from 'node:zlib';
import { readBooks } from './generate.ts';
import { echoesAnywhere } from './echoes.ts';
import { PARAMETERS, formulas } from './measures.ts';

const { books, refs } = readBooks();
const stock = formulas(books);
const echoes = echoesAnywhere(books, stock);

const where: { book: string; chapter: number }[] = books.flatMap(({ name }, b) =>
  refs[b].map(([chapter]) => ({ book: name, chapter: Number(chapter) })),
);

let pairs = 0;
let betweenBooks = 0;
let nearInBook = 0;
const bookPairs = new Map<string, number>();
echoes.forEach((others, a) =>
  others
    .filter((b) => a < b)
    .forEach((b) => {
      pairs++;
      if (where[a].book !== where[b].book) {
        betweenBooks++;
        const key = [where[a].book, where[b].book].sort().join(' / ');
        bookPairs.set(key, (bookPairs.get(key) ?? 0) + 1);
      } else if (b - a <= PARAMETERS.reachVerses) nearInBook++;
    }),
);

const file = JSON.stringify(
  Object.fromEntries(echoes.flatMap((o, v) => (o.length ? [[v, o]] : []))),
);
console.log(`Run of ${PARAMETERS.runWords} words; stock phrases set aside: ${stock.size}`);
console.log(`Verses with an echo: ${echoes.filter((o) => o.length).length} of ${echoes.length}`);
console.log(
  `Pairs: ${pairs} (between books ${betweenBooks}, within reach in one book ${nearInBook}, farther in one book ${pairs - betweenBooks - nearInBook})`,
);
console.log(
  `File: ${(file.length / 1024).toFixed(0)} KB, ${(gzipSync(file).length / 1024).toFixed(0)} KB gzipped`,
);
console.log(
  `Most pairs between books: ${[...bookPairs]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, n]) => `${k} ${n}`)
    .join('; ')}`,
);

type Range = [book: string, from: number, to: number];
const inside = (p: number, [book, from, to]: Range) =>
  where[p].book === book && where[p].chapter >= from && where[p].chapter <= to;
const parallels: [string, Range, Range[]][] = [
  ['Psalm 14 to 53', ['Psalms', 14, 14], [['Psalms', 53, 53]]],
  ['Psalm 53 to 14', ['Psalms', 53, 53], [['Psalms', 14, 14]]],
  [
    'Psalm 108 to 60 or 57',
    ['Psalms', 108, 108],
    [
      ['Psalms', 60, 60],
      ['Psalms', 57, 57],
    ],
  ],
  ['Psalm 60 to 108', ['Psalms', 60, 60], [['Psalms', 108, 108]]],
  ['Psalm 57 to 108', ['Psalms', 57, 57], [['Psalms', 108, 108]]],
  ['Exodus 25-31 to 35-40', ['Exodus', 25, 31], [['Exodus', 35, 40]]],
  ['Exodus 35-40 to 25-31', ['Exodus', 35, 40], [['Exodus', 25, 31]]],
  ['2 Samuel 22 to Psalm 18', ['II Samuel', 22, 22], [['Psalms', 18, 18]]],
  ['Psalm 18 to 2 Samuel 22', ['Psalms', 18, 18], [['II Samuel', 22, 22]]],
  ['Isaiah 36-39 to 2 Kings 18-20', ['Isaiah', 36, 39], [['II Kings', 18, 20]]],
  ['2 Kings 18-20 to Isaiah 36-39', ['II Kings', 18, 20], [['Isaiah', 36, 39]]],
  ['Numbers 7 to itself', ['Numbers', 7, 7], [['Numbers', 7, 7]]],
  [
    'Chronicles to Samuel and Kings',
    ['I Chronicles', 1, 99],
    [
      ['I Samuel', 1, 99],
      ['II Samuel', 1, 99],
      ['I Kings', 1, 99],
      ['II Kings', 1, 99],
    ],
  ],
  [
    'Samuel and Kings to Chronicles',
    ['I Samuel', 1, 99],
    [
      ['I Chronicles', 1, 99],
      ['II Chronicles', 1, 99],
    ],
  ],
];
// The ranges of Chronicles and Samuel-Kings take a second book each.
const extra: Record<string, Range[]> = {
  'Chronicles to Samuel and Kings': [['II Chronicles', 1, 99]],
  'Samuel and Kings to Chronicles': [
    ['II Samuel', 1, 99],
    ['I Kings', 1, 99],
    ['II Kings', 1, 99],
  ],
};
for (const [label, from, to] of parallels) {
  const starts = [from, ...(extra[label] ?? [])];
  let total = 0;
  let found = 0;
  echoes.forEach((others, p) => {
    if (!starts.some((r) => inside(p, r))) return;
    total++;
    if (others.some((o) => to.some((r) => inside(o, r)))) found++;
  });
  console.log(`${label}: ${found} of ${total} verses have an echo there`);
}
