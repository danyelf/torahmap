import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGLISH_LETTERS } from '../packages/search/src/english.ts';

const DATA = join(import.meta.dirname, '../public/data');
const TALMUD = join(DATA, 'talmud/english');
const FILES = [
  join(DATA, 'all-texts.json'),
  join(DATA, 'euaiact/texts.json'),
  ...readdirSync(TALMUD).map((file) => join(TALMUD, file)),
];

describe('the shipped English', () => {
  it('uses no Latin letter beyond a–z that English search does not know', () => {
    const unknown = new Set<string>();
    for (const file of FILES) {
      for (const [letter] of readFileSync(file, 'utf8').matchAll(/(?![a-z])\p{Script=Latin}/giu)) {
        if (!ENGLISH_LETTERS.includes(letter)) unknown.add(letter);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
