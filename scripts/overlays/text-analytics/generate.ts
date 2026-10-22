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
  divisionExample,
  divisionScores,
  parse,
  repetitionScores,
  type BookScores,
  type ParsedBook,
} from './measures.ts';

const DATA = join(import.meta.dirname, '../../../public/data');

const byNumber = (a: string, b: string): number => Number(a) - Number(b);

/** Every book, parsed, its verses in reading order; and where each verse sits. */
export function readBooks(): {
  texts: VerseTexts;
  books: ParsedBook[];
  refs: [string, string][][];
} {
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
  return { texts, books, refs };
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

// Short, well-known verses for each of the three commonest ways a first half is
// divided, and three uncommon ones.
const DIVISION_EXAMPLES: [book: string, chapter: string, verse: string, common: boolean][] = [
  ['Genesis', '2', '25', true],
  ['Genesis', '1', '1', true],
  ['Genesis', '12', '2', true],
  ['Exodus', '14', '4', false],
  ['Genesis', '21', '6', false],
  ['Genesis', '30', '41', false],
];

if (import.meta.main) {
  const { texts, books, refs } = readBooks();
  const division = divisionScores(books);
  const file: ScoresFile = {
    parameters: PARAMETERS,
    divisionExamples: DIVISION_EXAMPLES.map(([book, chapter, verse, common]) =>
      divisionExample(
        `${book} ${chapter}:${verse}`,
        texts[book][chapter][verse].he,
        division.counts,
        common,
      ),
    ),
    divisionPiecesPerVerse: Math.round(division.piecesPerVerse * 100) / 100,
    repetition: nest(books, refs, repetitionScores(books)),
    division: nest(books, refs, division.scores),
  };
  const out = join(DATA, SCORES_FILE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file) + '\n');
  console.log(`Wrote ${out}`);
}
