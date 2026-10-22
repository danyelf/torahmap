/**
 * Writes the Text analytics overlay's scores, every verse's repetitive-wording
 * and unusual-verse-division score, from the bundled verse texts.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/generate.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TEXTS_FILE, type VerseTexts } from '@torahmap/tanakh/verseTexts.ts';
import {
  SCORES_FILE,
  type MeasureScores,
  type ScoresFile,
} from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import {
  PARAMETERS,
  divisionScores,
  parse,
  repetitionScores,
  type BookScores,
  type ParsedBook,
} from './measures.ts';

const DATA = join(import.meta.dirname, '../../../public/data');

const byNumber = (a: string, b: string): number => Number(a) - Number(b);

/** Every book, parsed, its verses in reading order; and where each verse sits. */
export function readBooks(): { books: ParsedBook[]; refs: [string, string][][] } {
  const texts: VerseTexts = JSON.parse(readFileSync(join(DATA, TEXTS_FILE), 'utf8'));
  const books: ParsedBook[] = [];
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
    books.push(parse({ name, verses }));
    refs.push(where);
  }
  return { books, refs };
}

/** Book → chapter → scores by verse, from the first verse of the chapter. */
function nest(
  books: ParsedBook[],
  refs: [string, string][][],
  scores: BookScores[],
): MeasureScores {
  const result: MeasureScores = {};
  books.forEach((book, b) => {
    const chapters: MeasureScores[string] = {};
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
  const file: ScoresFile = {
    parameters: PARAMETERS,
    repetition: nest(books, refs, repetitionScores(books)),
    division: nest(books, refs, divisionScores(books).scores),
  };
  const out = join(DATA, SCORES_FILE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file) + '\n');
  console.log(`Wrote ${out}`);
}
