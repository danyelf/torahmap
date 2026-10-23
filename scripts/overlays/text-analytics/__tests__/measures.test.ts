import { describe, it, expect } from 'vitest';
import { PARAMETERS, repetitionScores, parse, words, type ParsedBook } from '../measures.ts';

const {
  minWords: MIN_WORDS,
  runWords: RUN_WORDS,
  reachVerses: REACH_VERSES,
  formulaBooks: FORMULA_BOOKS,
} = PARAMETERS;

const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';

/** A word no other call makes: `n` written in base 22 with Hebrew letters. */
function word(n: number): string {
  let s = '';
  do {
    s += LETTERS[n % LETTERS.length];
    n = Math.floor(n / LETTERS.length);
  } while (n > 0);
  return 'ש' + s;
}

let next = 1000;
const fresh = (count: number): string[] => Array.from({ length: count }, () => word(next++));

function book(name: string, verses: string[][]): ParsedBook {
  return parse({ name, verses: verses.map((words) => words.join(' ')) });
}

describe('words', () => {
  it('splits at a maqaf and drops section markers', () => {
    expect(words('אֶת־הָאָרֶץ וְאֵת {פ} הַשָּׁמַיִם׃')).toEqual(['את', 'הארץ', 'ואת', 'השמים']);
  });

  it('keeps the word read aloud and drops the one written in its place', () => {
    expect(words('(הוצא) [הַיְצֵא] אִתָּךְ')).toEqual(['היצא', 'אתך']);
  });

  it('matches words by consonants, whatever their points and marks', () => {
    expect(words('הָאָ֖רֶץ')).toEqual(words('הָאָרֶץ'));
  });
});

describe('repetitionScores', () => {
  const phrase = ['אמר', 'משה', 'לאהרן', 'ולבניו', 'לאמר'].slice(0, RUN_WORDS);

  it('marks a run that comes back within reach', () => {
    const verses = [
      [...phrase, ...fresh(8 - RUN_WORDS)],
      ...Array.from({ length: REACH_VERSES - 1 }, () => fresh(8)),
      [...phrase, ...fresh(8 - RUN_WORDS)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[verses.length - 1]).toBeGreaterThan(0);
  });

  it('does not mark a run that comes back only beyond reach', () => {
    const verses = [
      [...phrase, ...fresh(8 - RUN_WORDS)],
      ...Array.from({ length: REACH_VERSES }, () => fresh(8)),
      [...phrase, ...fresh(8 - RUN_WORDS)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBe(0);
  });

  it('does not mark words that repeat one short of a run', () => {
    const short = phrase.slice(0, -1);
    const verses = [
      [...short, ...fresh(8 - short.length)],
      [...short, ...fresh(8 - short.length)],
    ];
    expect(repetitionScores([book('A', verses)])[0]).toEqual([0, 0]);
  });

  it('ignores a run found in enough books to be a stock phrase', () => {
    const books = Array.from({ length: FORMULA_BOOKS }, (_, i) =>
      book(`B${i}`, [
        [...phrase, ...fresh(8 - RUN_WORDS)],
        [...phrase, ...fresh(8 - RUN_WORDS)],
      ]),
    );
    for (const scores of repetitionScores(books)) expect(scores).toEqual([0, 0]);
  });

  it('scores a verse by the share of its own words that are repeated, within its book', () => {
    const verses = [
      [...phrase, ...fresh(8 - RUN_WORDS)],
      [...phrase, ...fresh(12 - RUN_WORDS)],
    ];
    const [scores] = repetitionScores([book('A', verses), book('B', [fresh(8)])]);
    expect(scores).toEqual([RUN_WORDS / 8, RUN_WORDS / 12]);
  });

  it('leaves a verse under the minimum length without a score', () => {
    const verses = [
      [...phrase, ...fresh(MIN_WORDS - 1 - RUN_WORDS)],
      [...phrase, ...fresh(8 - RUN_WORDS)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBeNull();
    expect(scores[1]).not.toBeNull();
  });

  it('scores a verse alone, whatever its neighbours repeat', () => {
    const verses = [
      [...phrase, ...fresh(8 - RUN_WORDS)],
      fresh(8),
      [...phrase, ...fresh(8 - RUN_WORDS)],
    ];
    expect(repetitionScores([book('A', verses)])[0][1]).toBe(0);
  });
});
