/**
 * The runs that recur in many verses: how many there are, what a limit on them
 * would leave out, and what they say.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/formulas-report.ts
 */

import { readBooks } from './generate.ts';
// A run in more verses than this is listed as a formula.
const FORMULA_VERSES = 15;

const WORDS = 5;
const { books, refs } = readBooks();
const verses = books.flatMap(({ verses }) => verses);
const where = books.flatMap(({ name }, b) => refs[b].map(([chapter]) => ({ book: name, chapter })));

const at = new Map<string, Set<number>>();
verses.forEach((verse, v) => {
  for (let p = 0; p + WORDS <= verse.length; p++) {
    const run = verse.slice(p, p + WORDS).join(' ');
    if (!at.has(run)) at.set(run, new Set());
    at.get(run)!.add(v);
  }
});

const shared = [...at].filter(([, v]) => v.size >= 2);
const kept = shared.filter(([, v]) => v.size <= FORMULA_VERSES);
const formulas = shared.filter(([, v]) => v.size > FORMULA_VERSES);

const pairsOf = (runs: [string, Set<number>][]) => {
  const pairs = new Set<string>();
  for (const [, v] of runs) {
    const list = [...v];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) pairs.add(`${list[i]}-${list[j]}`);
  }
  return pairs;
};
const versesOf = (runs: [string, Set<number>][]) => new Set(runs.flatMap(([, v]) => [...v]));

const keptPairs = pairsOf(kept);
const keptVerses = versesOf(kept);
console.log(`${WORDS}-word runs found in two or more verses: ${shared.length}`);
console.log(
  `  in ${FORMULA_VERSES} verses or fewer (the rest): ${kept.length}, giving ${keptPairs.size} pairs over ${keptVerses.size} verses`,
);
console.log(`  in more than ${FORMULA_VERSES} verses (formulas): ${formulas.length}\n`);

console.log('What each higher limit would add');
for (const limit of [20, 30, 50, 100, Infinity]) {
  const runs = shared.filter(([, v]) => v.size <= limit);
  const pairs = pairsOf(runs);
  const most = new Map<number, number>();
  for (const pair of pairs)
    for (const v of pair.split('-').map(Number)) most.set(v, (most.get(v) ?? 0) + 1);
  console.log(
    `  limit ${limit}: ${runs.length - kept.length} more runs, ${pairs.size - keptPairs.size} more pairs, ` +
      `${versesOf(runs).size - keptVerses.size} more verses with an echo, most echoes on one verse ${Math.max(...most.values())}`,
  );
}

/** Where a run's verses are, most frequent books first. */
const spread = (v: Set<number>) => {
  const n = new Map<string, number>();
  for (const p of v) n.set(where[p].book, (n.get(where[p].book) ?? 0) + 1);
  const sorted = [...n].sort((a, b) => b[1] - a[1]);
  return `${sorted.length} book${sorted.length > 1 ? 's' : ''}: ${sorted
    .slice(0, 4)
    .map(([k, c]) => `${k} ${c}`)
    .join(', ')}`;
};

// A long formula gives one run per word it can start at; show one of them.
const overlapping = (a: string, b: string) => {
  const x = a.split(' ');
  const y = b.split(' ');
  return [1, 2, 3, 4].some(
    (k) =>
      x.slice(k).join(' ') === y.slice(0, -k).join(' ') ||
      y.slice(k).join(' ') === x.slice(0, -k).join(' '),
  );
};
console.log(`\nEvery formula, most verses first (one per overlapping group)`);
const printed: string[] = [];
for (const [run, v] of formulas.sort((a, b) => b[1].size - a[1].size)) {
  if (printed.some((p) => overlapping(p, run))) continue;
  printed.push(run);
  console.log(`  ${String(v.size).padStart(3)}  ${run}  (${spread(v)})`);
}
console.log(`  ${printed.length} groups`);
