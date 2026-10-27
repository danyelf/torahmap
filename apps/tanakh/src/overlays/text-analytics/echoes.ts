// The echoes file: for each verse, the verses anywhere in the Tanakh that share a run of words
// with it. Free of the page, so the script that writes the file can use it too.

import { ECHO_WORDS } from '@torahmap/overlay-catalog';
import { memoByValue } from '@torahmap/utils';

export const ECHOES_FILE = 'overlays/text-analytics/echoes.json';

/** The shortest run of words that makes two verses echoes, and the longest the file tells apart. */
export const MIN_WORDS = Number(ECHO_WORDS[0]);
export const MAX_WORDS = Number(ECHO_WORDS[ECHO_WORDS.length - 1]);

/**
 * Verse position → the later verses it shares a run with, as pairs of position and the words in
 * the longest run the two share (at most MAX_WORDS), in one list, by position. A position counts
 * verses from Genesis 1:1 in the order of the verse texts file (books, then chapters, then
 * verses). Each pair is listed once, under its earlier verse; a verse with none is left out.
 */
export type EchoesFile = Record<string, number[]>;

/** Every pair, listed under both its verses. */
const bothWays = memoByValue((file: EchoesFile) => {
  const pairs = new Map<number, [other: number, words: number][]>();
  const add = (verse: number, other: number, words: number) => {
    if (!pairs.has(verse)) pairs.set(verse, []);
    pairs.get(verse)!.push([other, words]);
  };
  for (const [verse, list] of Object.entries(file)) {
    for (let i = 0; i < list.length; i += 2) {
      add(Number(verse), list[i], list[i + 1]);
      add(list[i], Number(verse), list[i + 1]);
    }
  }
  return pairs;
});

/** The verses at `position` shares a run of at least `words` words with, each with its longest run. */
export function echoesAt(
  file: EchoesFile,
  position: number,
  words: number,
): [other: number, words: number][] {
  return (bothWays(file).get(position) ?? []).filter(([, shared]) => shared >= words);
}
