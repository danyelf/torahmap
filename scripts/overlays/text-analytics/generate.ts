/**
 * Writes the Text analytics overlay's scores, every verse's repetitive-wording
 * and common-and-rare-trop score, from the bundled verse texts.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/generate.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  MIN_WORDS,
  REACH_VERSES,
  RUN_WORDS,
  WINDOW_VERSES,
  repetitionScores,
  tropScores,
  type Book,
  type BookScores,
} from './measures.ts';

const DATA = join(import.meta.dirname, '../../../public/data');
const OUT = join(DATA, 'overlays/text-analytics/scores.json');

type Texts = Record<string, Record<string, Record<string, { he: string }>>>;

const byNumber = (a: string, b: string): number => Number(a) - Number(b);

/** Every book, its verses in reading order, and where each verse sits. */
export function readBooks(): { books: Book[]; refs: [string, string][][] } {
  const texts: Texts = JSON.parse(readFileSync(join(DATA, 'all-texts.json'), 'utf8'));
  const books: Book[] = [];
  const refs: [string, string][][] = [];
  for (const [name, chapters] of Object.entries(texts)) {
    const verses: string[] = [];
    const where: [string, string][] = [];
    for (const chapter of Object.keys(chapters).sort(byNumber)) {
      for (const verse of Object.keys(chapters[chapter]).sort(byNumber)) {
        verses.push(chapters[chapter][verse].he);
        where.push([chapter, verse]);
      }
    }
    books.push({ name, verses });
    refs.push(where);
  }
  return { books, refs };
}

/** Book → chapter → scores by verse, from the first verse of the chapter. */
function nest(
  books: Book[],
  refs: [string, string][][],
  scores: BookScores[],
): Record<string, Record<string, (number | null)[]>> {
  const result: Record<string, Record<string, (number | null)[]>> = {};
  books.forEach((book, b) => {
    const chapters: Record<string, (number | null)[]> = {};
    refs[b].forEach(([chapter, verse], i) => {
      const score = scores[b][i];
      (chapters[chapter] ??= [])[Number(verse) - 1] =
        score === null ? null : Math.round(score * 1000) / 1000;
    });
    result[book.name] = chapters;
  });
  return result;
}

if (import.meta.main) {
  const { books, refs } = readBooks();
  const file = {
    parameters: {
      windowVerses: WINDOW_VERSES,
      minWords: MIN_WORDS,
      runWords: RUN_WORDS,
      reachVerses: REACH_VERSES,
    },
    repetition: nest(books, refs, repetitionScores(books)),
    trop: nest(books, refs, tropScores(books)),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(file) + '\n');
  console.log(`Wrote ${OUT}`);
}
