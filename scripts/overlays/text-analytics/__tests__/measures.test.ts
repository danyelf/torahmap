import { describe, it, expect } from 'vitest';
import {
  FORMULA_BOOKS,
  MIN_WORDS,
  REACH_VERSES,
  WINDOW_VERSES,
  pieces,
  repetitionScores,
  divisionScores,
  parse,
  units,
  type ParsedBook,
} from '../measures.ts';

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

describe('units', () => {
  it('counts a maqaf-joined group as one word and drops section markers', () => {
    expect(units('אֶת־הָאָרֶץ וְאֵת {פ} הַשָּׁמַיִם׃').map((u) => u.consonants)).toEqual([
      'את־הארץ',
      'ואת',
      'השמים',
    ]);
  });

  it('keeps the word read aloud and drops the one written in its place', () => {
    expect(units('(הוצא) [הַיְצֵא] אִתָּךְ').map((u) => u.consonants)).toEqual(['היצא', 'אתך']);
  });

  it('matches words by consonants, whatever their points and marks', () => {
    expect(units('הָאָ֖רֶץ')[0].consonants).toBe(units('הָאָרֶץ')[0].consonants);
  });
});

describe('repetitionScores', () => {
  const phrase = ['אמר', 'משה', 'לאהרן'];

  it('marks a three-word run that comes back within reach', () => {
    const verses = [
      [...phrase, ...fresh(5)],
      ...Array.from({ length: REACH_VERSES - 1 }, () => fresh(8)),
      [...phrase, ...fresh(5)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[verses.length - 1]).toBeGreaterThan(0);
  });

  it('does not mark a run that comes back only beyond reach', () => {
    const verses = [
      [...phrase, ...fresh(5)],
      ...Array.from({ length: REACH_VERSES }, () => fresh(8)),
      [...phrase, ...fresh(5)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBe(0);
  });

  it('does not mark two words that repeat without a third', () => {
    const verses = [
      ['אמר', 'משה', ...fresh(6)],
      ['אמר', 'משה', ...fresh(6)],
    ];
    expect(repetitionScores([book('A', verses)])[0]).toEqual([0, 0]);
  });

  it('ignores a run found in enough books to be a stock phrase', () => {
    const books = Array.from({ length: FORMULA_BOOKS }, (_, i) =>
      book(`B${i}`, [
        [...phrase, ...fresh(5)],
        [...phrase, ...fresh(5)],
      ]),
    );
    for (const scores of repetitionScores(books)) expect(scores).toEqual([0, 0]);
  });

  it('scores a verse by the share of repeated words in its window, within its book', () => {
    // Two verses of eight words each, three of them repeated in each.
    const verses = [
      [...phrase, ...fresh(5)],
      [...phrase, ...fresh(5)],
    ];
    const [scores] = repetitionScores([book('A', verses), book('B', [fresh(8)])]);
    expect(scores).toEqual([6 / 16, 6 / 16]);
  });

  it('leaves a verse under the minimum length without a score', () => {
    const verses = [
      [...phrase, ...fresh(MIN_WORDS - 4)],
      [...phrase, ...fresh(5)],
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[0]).toBeNull();
    expect(scores[1]).not.toBeNull();
  });

  it('averages over the verses around a verse, not the whole book', () => {
    const half = (WINDOW_VERSES - 1) / 2;
    const verses = [
      [...phrase, ...fresh(5)],
      [...phrase, ...fresh(5)],
      ...Array.from({ length: WINDOW_VERSES }, () => fresh(8)),
    ];
    const [scores] = repetitionScores([book('A', verses)]);
    expect(scores[1 + half + 1]).toBe(0);
    expect(scores[1 + half]).toBeGreaterThan(0);
  });
});

// A word carrying one accent.
const ETNACHTA = 'אב\u0591';
const ZAQEF = 'אב\u0594';
const TIPCHA = 'אב\u0596';
const REVIA = 'אב\u0597';
const CONJ = 'אב\u05a5'; // merkha
const SEGOL = 'אב\u0592';
// Prose zarqa, written twice on its word.
const ZARQA = 'א\u0598ב\u05ae';
const LEGARMEH = 'אב\u05a3 ׀';

describe('pieces', () => {
  it('splits a verse at its strongest pause, then each piece at its own', () => {
    const verse = [CONJ, ZAQEF, CONJ, TIPCHA, CONJ, ETNACHTA, CONJ, TIPCHA, CONJ, 'אב'].join(' ');
    expect(pieces(units(verse))).toEqual([
      { kind: 'Verse', way: 'Etnachta' },
      { kind: 'Etnachta', way: 'Zaqef Qatan, Tipcha' },
      { kind: 'Zaqef Qatan', way: '' },
      { kind: 'Tipcha', way: '' },
      { kind: 'Etnachta:2', way: '' },
      { kind: 'Silluq:1', way: 'Tipcha' },
      { kind: 'Tipcha', way: '' },
      { kind: 'Silluq:2', way: '' },
    ]);
  });

  it('reads prose zarqa as the pause before a segol', () => {
    const verse = [CONJ, ZARQA, CONJ, SEGOL, CONJ, ZAQEF, CONJ, ETNACHTA, CONJ, 'אב'].join(' ');
    expect(pieces(units(verse)).slice(1, 3)).toEqual([
      { kind: 'Etnachta', way: 'Segol, Zaqef Qatan' },
      { kind: 'Segol', way: 'Zinor' },
    ]);
  });

  it('reads munach before a paseq as a pause of its own', () => {
    const verse = [LEGARMEH, CONJ, REVIA, CONJ, ETNACHTA, CONJ, 'אב'].join(' ');
    expect(pieces(units(verse)).slice(0, 3)).toEqual([
      { kind: 'Verse', way: 'Etnachta' },
      { kind: 'Etnachta', way: 'Revia' },
      { kind: 'Revia', way: 'Legarmeh' },
    ]);
  });
});

describe('divisionScores', () => {
  // Seven words each: a common shape, and a rarer one of the same length.
  const common = [CONJ, TIPCHA, CONJ, ETNACHTA, CONJ, TIPCHA, 'אב'];
  const rare = [CONJ, REVIA, CONJ, ETNACHTA, CONJ, TIPCHA, 'אב'];
  const passage = (shape: string[], count: number): string[][] =>
    Array.from({ length: count }, () => shape);

  it('scores a passage of rare splits above zero and one of common splits below', () => {
    const [commonBook, rareBook] = divisionScores([
      book('A', passage(common, 30)),
      book('B', passage(rare, WINDOW_VERSES)),
    ]).scores;
    expect(commonBook[15]).toBeLessThan(0);
    expect(rareBook[(WINDOW_VERSES - 1) / 2]).toBeGreaterThan(0);
  });

  it('counts how often each kind of piece is split each way', () => {
    const { counts } = divisionScores([book('A', [...passage(common, 3), ...passage(rare, 1)])]);
    expect(counts.get('Etnachta')).toEqual(
      new Map([
        ['Tipcha', 3],
        ['Revia', 1],
      ]),
    );
  });

  it('compares a verse only with verses of about its length', () => {
    // Long verses split one way and short ones another: each is common for its length.
    const long = [CONJ, ZAQEF, CONJ, TIPCHA, CONJ, ETNACHTA, CONJ, ZAQEF, CONJ, TIPCHA, 'אב'];
    const [shortBook, longBook] = divisionScores([
      book('A', passage(common, 20)),
      book('B', passage(long, 20)),
    ]).scores;
    expect(shortBook[10]).toBeCloseTo(0);
    expect(longBook[10]).toBeCloseTo(0);
  });

  it('gives no score to a short verse, nor to the books with their own marks', () => {
    const [prose, psalms] = divisionScores([
      book('A', [...passage(common, 5), [CONJ, ETNACHTA, 'אב']]),
      book('Psalms', passage(common, 5)),
    ]).scores;
    expect(prose[5]).toBeNull();
    expect(prose[0]).not.toBeNull();
    expect(psalms).toEqual([null, null, null, null, null]);
  });
});
