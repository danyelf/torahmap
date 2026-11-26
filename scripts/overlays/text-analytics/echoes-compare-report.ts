/**
 * What echoes and repetitive wording each show that the other does not, what the shortest scored
 * verse hides, and what matching by dictionary word in place of spelling would add to echoes.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/echoes-compare-report.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readBooks } from './generate.ts';
import { echoesAnywhere } from './echoes.ts';
import { PARAMETERS, repetitionScores, type ParsedBook } from './measures.ts';

const WORDS = 5;
const DATA = join(import.meta.dirname, '../../../public/data');

const { books, refs } = readBooks();
const where = books.flatMap(({ name }, b) =>
  refs[b].map(([chapter, verse], i) => ({ book: name, b, i, chapter, verse })),
);
const name = (p: number) => `${where[p].book} ${where[p].chapter}:${where[p].verse}`;
const share = (n: number, of: number) => `${n} (${((100 * n) / of).toFixed(0)}%)`;

const scores = repetitionScores(books).flat();
const lengths = books.flatMap(({ verses }) => verses.map((v) => v.length));
const echoes = echoesAnywhere(books).map((others) => others.filter(([, w]) => w >= WORDS));
const near = (a: number, b: number) =>
  where[a].b === where[b].b && Math.abs(where[a].i - where[b].i) <= PARAMETERS.reachVerses;

console.log(`Verses: ${where.length}. Echoes counted at ${WORDS} words or more.\n`);

// 1. The two analyses against each other.
const repeats = where.map((_, p) => (scores[p] ?? 0) > 0);
const hasEcho = echoes.map((others) => others.length > 0);
const hasNearEcho = echoes.map((others, p) => others.some(([o]) => near(p, o)));
const count = (flags: boolean[]) => flags.filter(Boolean).length;
const both = (a: boolean[], b: boolean[]) => count(a.map((x, i) => x && b[i]));

const nRepeats = count(repeats);
console.log('Repetitive wording against echoes');
console.log(`  verses repetitive wording colours (score above 0): ${nRepeats}`);
console.log(`    of those, with an echo anywhere: ${share(both(repeats, hasEcho), nRepeats)}`);
console.log(
  `    of those, with an echo in the same book within ${PARAMETERS.reachVerses} verses: ${share(both(repeats, hasNearEcho), nRepeats)}`,
);
const onlyRepeats = where.map((_, p) => repeats[p] && !hasEcho[p]);
console.log(`  coloured by repetitive wording, no echo at all: ${count(onlyRepeats)}`);
const byChapter = (flags: boolean[]) => {
  const chapters = new Map<string, number>();
  flags.forEach((f, p) => {
    if (!f) return;
    const key = `${where[p].book} ${where[p].chapter}`;
    chapters.set(key, (chapters.get(key) ?? 0) + 1);
  });
  return [...chapters]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
};
console.log(`    most in: ${byChapter(onlyRepeats)}`);

const nEcho = count(hasEcho);
const nNear = count(hasNearEcho);
console.log(`  verses with an echo anywhere: ${nEcho}`);
console.log(`    with every echo outside repetitive wording's reach: ${nEcho - nNear}`);
const nearNotRepeats = where.map((_, p) => hasNearEcho[p] && !repeats[p]);
console.log(
  `  verses with a near echo that repetitive wording leaves uncoloured: ${count(nearNotRepeats)}`,
);
console.log(
  `    of those, shorter than ${PARAMETERS.minWords} words: ${count(nearNotRepeats.map((f, p) => f && lengths[p] < PARAMETERS.minWords))}`,
);
console.log(`    most in: ${byChapter(nearNotRepeats)}`);

// 2. The shortest verse repetitive wording scores.
const short = lengths.map((n) => n < PARAMETERS.minWords);
const reachable = lengths.map((n) => n >= WORDS && n < PARAMETERS.minWords);
console.log(`\nVerses shorter than ${PARAMETERS.minWords} words (unscored by repetitive wording)`);
console.log(`  ${share(count(short), where.length)} of all verses`);
console.log(`  long enough to hold a ${WORDS}-word run: ${count(reachable)}`);
console.log(
  `  with an echo: ${both(short, hasEcho)}; with a near echo: ${both(short, hasNearEcho)}`,
);
console.log(`  most in: ${byChapter(short.map((s, p) => s && hasNearEcho[p]))}`);

// 3. Dictionary words in place of spellings.
const morphology: {
  verses: Record<string, [morphemes: [number, number][], words: number[], joined: number[]]>;
} = JSON.parse(readFileSync(join(DATA, 'search/verse-morphology.json'), 'utf8'));

/** A verse's printed words, each as the dictionary word of its last part, so prefixes drop away. */
function dictionaryWords(key: string): string[] {
  const verse = morphology.verses[key];
  if (!verse) throw new Error(`no dictionary words for ${key}`);
  const [morphemes, perWord] = verse;
  const result: string[] = [];
  let at = 0;
  for (const n of perWord) {
    at += n;
    if (n > 0) result.push(String(morphemes[at - 1][0]));
  }
  return result;
}

const byDictionary: ParsedBook[] = books.map(({ name: book }, b) => ({
  name: book,
  verses: refs[b].map(([chapter, verse]) =>
    dictionaryWords(`${book.replaceAll(' ', '.')}.${chapter}.${verse}`),
  ),
}));
const loose = echoesAnywhere(byDictionary).map((others) => others.filter(([, w]) => w >= WORDS));

const pairsOf = (list: [number, number][][]) =>
  new Set(list.flatMap((others, a) => others.filter(([b]) => a < b).map(([b]) => `${a}-${b}`)));
const exact = pairsOf(echoes);
const looser = pairsOf(loose);
const gained = [...looser].filter((p) => !exact.has(p));
const lost = [...exact].filter((p) => !looser.has(p));
const kind = (pair: string) => {
  const [a, b] = pair.split('-').map(Number);
  if (where[a].b !== where[b].b) return 'another book';
  return where[a].chapter === where[b].chapter ? 'same chapter' : 'same book';
};
const kinds = (pairs: string[]) => {
  const n = new Map<string, number>();
  pairs.forEach((p) => n.set(kind(p), (n.get(kind(p)) ?? 0) + 1));
  return [...n].map(([k, v]) => `${k} ${v}`).join(', ');
};
console.log('\nMatching by dictionary word in place of spelling');
console.log(`  pairs by spelling: ${exact.size} (${kinds([...exact])})`);
console.log(`  pairs by dictionary word: ${looser.size} (${kinds([...looser])})`);
console.log(`  gained: ${gained.length} (${kinds(gained)})`);
console.log(
  `  lost (the same spelling, but different dictionary words): ${lost.length} (${kinds(lost)})`,
);
const looseHasEcho = loose.map((others) => others.length > 0);
console.log(
  `  verses with an echo: ${nEcho} by spelling, ${count(looseHasEcho)} by dictionary word`,
);

const sample = (pairs: string[], n: number) =>
  Array.from({ length: n }, (_, k) => pairs[Math.floor((k * pairs.length) / n)]);
const show = (pair: string) => {
  const [a, b] = pair.split('-').map(Number);
  return `    ${name(a)} / ${name(b)}`;
};
console.log('  gained, another book, evenly spread sample:');
sample(
  gained.filter((p) => kind(p) === 'another book'),
  25,
).forEach((p) => console.log(show(p)));
console.log('  gained, same book or chapter, evenly spread sample:');
sample(
  gained.filter((p) => kind(p) !== 'another book'),
  15,
).forEach((p) => console.log(show(p)));
console.log('  lost, evenly spread sample:');
sample(lost, 10).forEach((p) => console.log(show(p)));
