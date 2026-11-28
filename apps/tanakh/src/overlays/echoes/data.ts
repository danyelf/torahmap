// The echoes file: for each verse, the verses anywhere in the Tanakh that share a run of words
// with it. Free of the page, so the script that writes the file can use it too.

import { ECHO_WORDS } from '@torahmap/overlay-catalog';
import { memoByValue } from '@torahmap/utils';

export const ECHOES_FILE = 'overlays/echoes/echoes.json';

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

// The verses a run of parallel verses may skip on either side between one pair and the next. At 2 the
// run from Isaiah 36:1 stops at once, since II Kings 18:14-16 are not in Isaiah; at 5 Jeremiah 52
// reaches the end of II Kings 25; 8 adds little more.
const RUN_GAP = 5;

/**
 * The run of parallel verses that `position`'s echoes belong to: from each echo, verse after verse
 * on both sides, as long as each next verse shares a run of at least `words` words with a verse
 * just past the last one's echo. Pairs of position and its echo, the first always on the side of
 * `position`; empty for a verse without echoes.
 */
export function echoRun(file: EchoesFile, position: number, words: number): [number, number][] {
  const shares = (a: number, b: number) => echoesAt(file, a, words).some(([other]) => other === b);
  // The next pair after (a, b) in direction `dir`, nearest first.
  const next = (a: number, b: number, dir: 1 | -1): [number, number] | null => {
    for (let reach = 2; reach <= 2 * (RUN_GAP + 1); reach++) {
      for (let da = 1; da <= RUN_GAP + 1; da++) {
        const db = reach - da;
        if (db >= 1 && db <= RUN_GAP + 1 && shares(a + dir * da, b + dir * db)) {
          return [a + dir * da, b + dir * db];
        }
      }
    }
    return null;
  };
  const run = new Map<string, [number, number]>();
  for (const [echo] of echoesAt(file, position, words)) {
    run.set(`${position} ${echo}`, [position, echo]);
    for (const dir of [1, -1] as const) {
      let pair = next(position, echo, dir);
      while (pair && !run.has(`${pair[0]} ${pair[1]}`)) {
        run.set(`${pair[0]} ${pair[1]}`, pair);
        pair = next(pair[0], pair[1], dir);
      }
    }
  }
  return [...run.values()];
}
