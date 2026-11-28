/**
 * The runs that recur in many verses: how many there are, where, and what they say.
 *
 * Run with: npx tsx scripts/overlays/echoes/formulas-report.ts
 */

import { ECHOES } from '@torahmap/overlay-catalog';
import { readBooks } from './generate.ts';

// A run in more verses than this is listed as a formula.
const FORMULA_VERSES = 15;
const WORDS = Number(ECHOES.urlParams[0].default);

const { books, refs } = readBooks();
const verses = books.flatMap(({ verses }) => verses);
const bookOf = books.flatMap(({ name }, b) => refs[b].map(() => name));

const at = new Map<string, Set<number>>();
verses.forEach((verse, v) => {
  for (let p = 0; p + WORDS <= verse.length; p++) {
    const run = verse.slice(p, p + WORDS).join(' ');
    if (!at.has(run)) at.set(run, new Set());
    at.get(run)!.add(v);
  }
});

const shared = [...at].filter(([, v]) => v.size >= 2);
const formulas = shared.filter(([, v]) => v.size > FORMULA_VERSES);
console.log(`${WORDS}-word runs found in two or more verses: ${shared.length}`);
console.log(`  in more than ${FORMULA_VERSES} verses (formulas): ${formulas.length}`);

/** Where a run's verses are, most frequent books first. */
const spread = (v: Set<number>) => {
  const n = new Map<string, number>();
  for (const p of v) n.set(bookOf[p], (n.get(bookOf[p]) ?? 0) + 1);
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
  return Array.from({ length: WORDS - 1 }, (_, k) => k + 1).some(
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
