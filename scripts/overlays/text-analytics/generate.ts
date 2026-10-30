/**
 * Writes the Text Analytics overlay's scores, every verse's repetitive-wording
 * score, and the echoes between verses anywhere, from the bundled verse texts.
 *
 * Run with: npx tsx scripts/overlays/text-analytics/generate.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TEXTS_FILE, type VerseTexts } from '@torahmap/tanakh/verseTexts.ts';
import {
  SCORES_FILE,
  type MeasureScores,
  type Echoes,
  type RepeatedWords,
  type ScoresFile,
} from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import { ECHOES_FILE, type EchoesFile } from '@torahmap/tanakh/overlays/text-analytics/echoes.ts';
import { echoesAnywhere } from './echoes.ts';
import {
  PARAMETERS,
  parse,
  echoes,
  repeatedStretches,
  repeatedWords,
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

/** Where each scored verse's repeated words are, leaving out verses with none. */
function nestStretches(
  books: ParsedBook[],
  refs: [string, string][][],
  scores: BookScores[],
  flags: boolean[][][],
): RepeatedWords {
  const result: RepeatedWords = {};
  books.forEach((book, b) => {
    const chapters: RepeatedWords[string] = {};
    refs[b].forEach(([chapter, verse], i) => {
      const stretches = scores[b][i] === null ? [] : repeatedStretches(flags[b][i]);
      if (stretches.length > 0) (chapters[chapter] ??= {})[verse] = stretches;
    });
    result[book.name] = chapters;
  });
  return result;
}

/** Each verse's echoes, leaving out verses with none. */
function nestEchoes(
  books: ParsedBook[],
  refs: [string, string][][],
  offsets: number[][][],
): Echoes {
  const result: Echoes = {};
  books.forEach((book, b) => {
    const chapters: Echoes[string] = {};
    refs[b].forEach(([chapter, verse], i) => {
      if (offsets[b][i].length > 0) (chapters[chapter] ??= {})[verse] = offsets[b][i];
    });
    result[book.name] = chapters;
  });
  return result;
}

if (import.meta.main) {
  const { books, refs } = readBooks();
  const scores = repetitionScores(books);
  const file: ScoresFile = {
    parameters: PARAMETERS,
    repetition: nest(books, refs, scores),
    repeated: nestStretches(books, refs, scores, repeatedWords(books)),
    echoes: nestEchoes(books, refs, echoes(books)),
  };
  const out = join(DATA, SCORES_FILE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file) + '\n');
  console.log(`Wrote ${out}`);

  const everyEcho: EchoesFile = {};
  echoesAnywhere(books).forEach((others, v) => {
    const later = others.filter(([other]) => other > v).flat();
    if (later.length > 0) everyEcho[v] = later;
  });
  const echoesOut = join(DATA, ECHOES_FILE);
  writeFileSync(echoesOut, JSON.stringify(everyEcho) + '\n');
  console.log(`Wrote ${echoesOut}`);
}
