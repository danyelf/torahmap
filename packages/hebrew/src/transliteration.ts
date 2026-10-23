// Hebrew written in English letters, as names of books and tractates are.

import { foldFinalLetters } from './spelling.ts';

/**
 * A word as it sounds rather than as it is spelled, so that the ways one
 * Hebrew name is written in English letters come out alike: the
 * transliterations of one Hebrew letter written alike, a closing -ah or -s
 * dropped or written as -t, vowels after the first letter gone, and doubled
 * letters single. A word in Hebrew letters loses its vowel letters and its
 * final forms. Expects lower case.
 */
export function soundOfName(word: string): string {
  const sounds = foldFinalLetters(word)
    .replace(/kh|ch/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/tz|ts/g, 'z')
    .replace(/[qc]/g, 'k')
    .replace(/[vw]/g, 'b')
    .replace(/ah$/, 'a')
    .replace(/s$/, 't');
  const consonants = sounds[0] + sounds.slice(1).replace(/[aeiouוי]/g, '');
  return consonants.replace(/(.)\1+/g, '$1');
}
