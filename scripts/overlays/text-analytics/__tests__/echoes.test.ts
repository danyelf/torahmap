import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ECHOES_FILE, type EchoesFile } from '@torahmap/tanakh/overlays/text-analytics/echoes.ts';
import { TEXTS_FILE, type VerseTexts } from '@torahmap/tanakh/verseTexts.ts';
import { echoesAnywhere } from '../echoes.ts';
import { PARAMETERS, parse, type ParsedBook } from '../measures.ts';

const phrase = ['אמר', 'משה', 'לאהרן', 'ולבניו', 'לאמר', 'שלום'].slice(0, PARAMETERS.runWords);
const filler = (tag: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${tag}${'אבגדהוזחט'[i % 9]}${'א'.repeat(i)}`);
const book = (name: string, verses: string[][]): ParsedBook =>
  parse({ name, verses: verses.map((v) => v.join(' ')) });

describe('echoesAnywhere', () => {
  it('pairs verses of different books, whatever the distance between them', () => {
    const far = Array.from({ length: 200 }, (_, i) => filler(`ג${'ב'.repeat(i)}`, 7));
    const books = [
      book('A', [[...phrase, ...filler('א', 3)], ...far]),
      book('B', [[...filler('ב', 2), ...phrase]]),
    ];
    const echoes = echoesAnywhere(books);
    expect(echoes[0]).toEqual([201]);
    expect(echoes[201]).toEqual([0]);
    expect(echoes[100]).toEqual([]);
  });

  it('does not pair a verse with itself', () => {
    expect(echoesAnywhere([book('A', [[...phrase, ...phrase]])])).toEqual([[]]);
  });
});

describe('the shipped echoes file', () => {
  const data = join(import.meta.dirname, '../../../../public/data');
  const echoes: EchoesFile = JSON.parse(readFileSync(join(data, ECHOES_FILE), 'utf8'));
  const texts: VerseTexts = JSON.parse(readFileSync(join(data, TEXTS_FILE), 'utf8'));
  const verseCount = Object.values(texts)
    .flatMap((chapters) => Object.values(chapters))
    .reduce((n, verses) => n + Object.keys(verses).length, 0);

  it('names only verses that exist', () => {
    for (const [verse, others] of Object.entries(echoes)) {
      for (const position of [Number(verse), ...others]) {
        expect(Number.isInteger(position) && position >= 0 && position < verseCount).toBe(true);
      }
    }
  });

  it('lists every pair under both verses, without a verse echoing itself', () => {
    for (const [verse, others] of Object.entries(echoes)) {
      expect(others).not.toContain(Number(verse));
      for (const other of others) expect(echoes[other]).toContain(Number(verse));
    }
  });
});
