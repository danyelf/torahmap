/**
 * What the Text analytics scores show across the whole Tanakh: the most and
 * least repetitive and rare-trop chapters, whether either score follows verse
 * length, how many stock phrases are set aside, and how often the first half
 * of a verse is split each way.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/report.ts
 */

import { readBooks } from './generate.ts';
import {
  MIN_WORDS,
  POETIC_BOOKS,
  formulas,
  pieces,
  repetitionScores,
  tropScores,
  units,
  type BookScores,
} from './measures.ts';

const { books, refs } = readBooks();
const lengths = books.map((b) => b.verses.map((v) => units(v).length));

function correlation(xs: number[], ys: number[]): number {
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}

function describe(title: string, scores: BookScores[], format: (v: number) => string): void {
  console.log(`\n## ${title}\n`);
  const chapters: { name: string; mean: number }[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  books.forEach((book, b) => {
    const byChapter = new Map<string, number[]>();
    refs[b].forEach(([chapter], i) => {
      const score = scores[b][i];
      if (score === null) return;
      if (!byChapter.has(chapter)) byChapter.set(chapter, []);
      byChapter.get(chapter)!.push(score);
      xs.push(lengths[b][i]);
      ys.push(score);
    });
    for (const [chapter, values] of byChapter) {
      chapters.push({
        name: `${book.name} ${chapter}`,
        mean: values.reduce((s, v) => s + v, 0) / values.length,
      });
    }
  });
  chapters.sort((a, b) => b.mean - a.mean);
  const list = (cs: typeof chapters) => cs.map((c) => `${c.name} (${format(c.mean)})`).join(', ');
  const sorted = [...ys].sort((a, b) => a - b);
  const at = (q: number) => format(sorted[Math.floor(q * (sorted.length - 1))]);
  console.log(`Verses scored: ${ys.length}`);
  console.log(`Percentiles 2/50/98: ${at(0.02)} / ${at(0.5)} / ${at(0.98)}`);
  console.log(`Correlation with verse length: ${correlation(xs, ys).toFixed(2)}`);
  console.log(`Highest chapters: ${list(chapters.slice(0, 20))}`);
  console.log(`Lowest chapters: ${list(chapters.slice(-12).reverse())}`);
}

const percent = (v: number) => `${Math.round(v * 100)}%`;
const bits = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

console.log(`Stock phrases set aside: ${formulas(books).size}`);

const repetition = repetitionScores(books);
describe('Repetitive wording', repetition, percent);
const poetic = books.flatMap((b, i) => (POETIC_BOOKS.has(b.name) ? [i] : []));
describe(
  'Repetitive wording, Psalms, Proverbs and Job',
  repetition.map((s, i) => (poetic.includes(i) ? s : s.map(() => null))),
  percent,
);

describe('Common and rare trop (bits against verses of the same length)', tropScores(books), bits);

const ways = new Map<string, number>();
books.forEach((book) => {
  if (POETIC_BOOKS.has(book.name)) return;
  for (const verse of book.verses) {
    const us = units(verse);
    if (us.length < MIN_WORDS) continue;
    for (const p of pieces(us))
      if (p.kind === 'etnachta') ways.set(p.way, (ways.get(p.way) ?? 0) + 1);
  }
});
const halves = [...ways.values()].reduce((s, n) => s + n, 0);
console.log('\n## How a first half (ending on etnachta) is split\n');
[...ways]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .forEach(([way, n]) => console.log(`${way || '(not split)'}: ${percent(n / halves)}`));
