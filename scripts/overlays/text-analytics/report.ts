/**
 * What the Text analytics scores show across the whole Tanakh: the highest and
 * lowest chapters on each measure, whether either score follows verse length,
 * how many stock phrases are set aside, and how often the first half of a
 * verse is split each way.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/report.ts
 */

import { readBooks } from './generate.ts';
import {
  HIGH_PERCENTILE,
  LOW_PERCENTILE,
  MEASURE_LABELS,
  bits,
  listed,
  percent,
  percentile,
} from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import {
  PARAMETERS,
  divisionScores,
  formulas,
  repetitionScores,
  type BookScores,
} from './measures.ts';

const { books, refs } = readBooks();

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
      xs.push(book.verses[i].length);
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
  const at = (q: number) => format(percentile(sorted, q));
  console.log(`Verses scored: ${ys.length}`);
  console.log(
    `Colour scale from ${at(LOW_PERCENTILE)} to ${at(HIGH_PERCENTILE)}; median ${at(0.5)}`,
  );
  console.log(`Correlation with verse length: ${correlation(xs, ys).toFixed(2)}`);
  console.log(`Highest chapters: ${list(chapters.slice(0, 20))}`);
  console.log(`Lowest chapters: ${list(chapters.slice(-12).reverse())}`);
}

const poetic = listed(PARAMETERS.poeticBooks);

console.log(
  `Stock phrases (found in ${PARAMETERS.formulaBooks} or more books) set aside: ${formulas(books).size}`,
);

const repetition = repetitionScores(books);
describe(MEASURE_LABELS.repetition, repetition, percent);
describe(
  `${MEASURE_LABELS.repetition}, ${poetic}`,
  repetition.map((s, i) =>
    PARAMETERS.poeticBooks.includes(books[i].name) ? s : s.map(() => null),
  ),
  percent,
);

const division = divisionScores(books);
describe(
  `${MEASURE_LABELS.division} (against verses of the same length; ${poetic} left out)`,
  division.scores,
  bits,
);

const halves = division.counts.get('Etnachta')!;
const total = [...halves.values()].reduce((s, n) => s + n, 0);
console.log('\n## How a first half (ending on etnachta) is split\n');
[...halves]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .forEach(([way, n]) => console.log(`${way || '(not split)'}: ${percent(n / total)}`));
