/**
 * Writes the Echoes overlay's file, the echoes between verses anywhere, from the bundled verse
 * texts.
 *
 * Run with: npx tsx scripts/overlays/echoes/generate.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TEXTS_FILE, type VerseTexts } from '@torahmap/tanakh/verseTexts.ts';
import { ECHOES_FILE, type EchoesFile } from '@torahmap/tanakh/overlays/echoes/data.ts';
import { words } from '@torahmap/tanakh/overlays/echoes/words.ts';
import { echoesAnywhere, type Book } from './echoes.ts';

const DATA = join(import.meta.dirname, '../../../public/data');

const byNumber = (a: string, b: string): number => Number(a) - Number(b);

/** Every book, parsed, its verses in reading order; and where each verse sits. */
export function readBooks(): { books: Book[]; refs: [string, string][][] } {
  const texts: VerseTexts = JSON.parse(readFileSync(join(DATA, TEXTS_FILE), 'utf8'));
  const books: Book[] = [];
  const refs: [string, string][][] = [];
  for (const [name, chapters] of Object.entries(texts)) {
    const verses: string[][] = [];
    const where: [string, string][] = [];
    for (const chapter of Object.keys(chapters).sort(byNumber)) {
      for (const verse of Object.keys(chapters[chapter]).sort(byNumber)) {
        verses.push(words(chapters[chapter][verse].he));
        where.push([chapter, verse]);
      }
    }
    books.push({ name, verses });
    refs.push(where);
  }
  return { books, refs };
}

/** The echoes file for these books: each verse's echoes in later verses. */
export function buildEchoesFile(echoes: [other: number, words: number][][]): EchoesFile {
  const file: EchoesFile = {};
  echoes.forEach((others, v) => {
    const later = others.filter(([other]) => other > v).flat();
    if (later.length > 0) file[v] = later;
  });
  return file;
}

if (import.meta.main) {
  const { books } = readBooks();
  const everyEcho = buildEchoesFile(echoesAnywhere(books));
  const out = join(DATA, ECHOES_FILE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(everyEcho) + '\n');
  console.log(`Wrote ${out}`);
}
