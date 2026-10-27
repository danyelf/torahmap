import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ECHOES_FILE,
  MAX_WORDS,
  MIN_WORDS,
  type EchoesFile,
} from '@torahmap/tanakh/overlays/text-analytics/echoes.ts';
import { TEXTS_FILE, type VerseTexts } from '@torahmap/tanakh/verseTexts.ts';
import { echoesAnywhere } from '../echoes.ts';
import { parse, type ParsedBook } from '../measures.ts';

const unique = (tag: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${tag}${'א'.repeat(i + 1)}`);
const run = (count: number) => unique('ר', count);
const book = (name: string, verses: string[][]): ParsedBook =>
  parse({ name, verses: verses.map((v) => v.join(' ')) });

describe('echoesAnywhere', () => {
  it('pairs verses of different books, whatever the distance, with the length of their longest run', () => {
    const far = Array.from({ length: 200 }, (_, i) => unique(`ג${'ב'.repeat(i)}`, 7));
    const books = [
      book('A', [[...run(6), ...unique('א', 3)], ...far]),
      book('B', [[...unique('ב', 2), ...run(6)]]),
    ];
    const echoes = echoesAnywhere(books);
    expect(echoes[0]).toEqual([[201, 6]]);
    expect(echoes[201]).toEqual([[0, 6]]);
    expect(echoes[100]).toEqual([]);
  });

  it('does not pair verses that share fewer words than the shortest run', () => {
    const books = [
      book('A', [
        [...run(MIN_WORDS - 1), ...unique('א', 4)],
        [...run(MIN_WORDS - 1), ...unique('ב', 4)],
      ]),
    ];
    expect(echoesAnywhere(books)).toEqual([[], []]);
  });

  it('counts a run no longer than the longest the file tells apart', () => {
    const books = [book('A', [run(MAX_WORDS + 3), run(MAX_WORDS + 3)])];
    expect(echoesAnywhere(books)[0]).toEqual([[1, MAX_WORDS]]);
  });

  it('sets aside a run found in more verses than the limit, and keeps one at the limit', () => {
    const verses = [0, 1, 2, 3].map((i) => [...run(5), ...unique(`ו${i}`, 3)]);
    expect(echoesAnywhere([book('A', verses)], 3)).toEqual([[], [], [], []]);
    expect(echoesAnywhere([book('A', verses)], 4)[0]).toHaveLength(3);
  });

  it('does not pair a verse with itself', () => {
    expect(echoesAnywhere([book('A', [[...run(5), ...run(5)]])])).toEqual([[]]);
  });
});

describe('the shipped echoes file', () => {
  const data = join(import.meta.dirname, '../../../../public/data');
  const echoes: EchoesFile = JSON.parse(readFileSync(join(data, ECHOES_FILE), 'utf8'));
  const texts: VerseTexts = JSON.parse(readFileSync(join(data, TEXTS_FILE), 'utf8'));
  const verseCount = Object.values(texts)
    .flatMap((chapters) => Object.values(chapters))
    .reduce((n, verses) => n + Object.keys(verses).length, 0);

  it('lists each pair once, under its earlier verse, naming verses that exist', () => {
    for (const [verse, pairs] of Object.entries(echoes)) {
      expect(pairs.length % 2).toBe(0);
      for (let i = 0; i < pairs.length; i += 2) {
        expect(pairs[i]).toBeGreaterThan(Number(verse));
        expect(pairs[i]).toBeLessThan(verseCount);
      }
    }
  });

  it('gives each pair a length the file tells apart', () => {
    for (const pairs of Object.values(echoes)) {
      for (let i = 1; i < pairs.length; i += 2) {
        expect(pairs[i]).toBeGreaterThanOrEqual(MIN_WORDS);
        expect(pairs[i]).toBeLessThanOrEqual(MAX_WORDS);
      }
    }
  });
});
