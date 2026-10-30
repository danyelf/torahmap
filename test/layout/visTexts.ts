// Made-up paper text for the VIS states, so they never read the real papers (copyright keeps
// those out of git and out of screenshots).
import { readFileSync } from 'node:fs';
import { papersOf, type Structure } from '@torahmap/ieeevis/data.ts';
import { pieceId } from '@torahmap/ieeevis/layout.ts';

const STRUCTURE = new URL('../../public/data/ieeevis/structure.json', import.meta.url);
const WORDS = ['chart', 'colour', 'axis', 'glyph', 'mark', 'scale', 'layout', 'filter', 'trend'];
/** Found by the states that search; every seventh piece carries it. */
const SEARCHED = 'drucker';

const piece = (paper: number, n: number, letter: string): string => {
  const seed = paper * 31 + n;
  if (letter === 'f') {
    return Array.from(
      { length: 12 },
      (_, i) => `[${i + 1}] Author A. Stand-in reference ${i}.`,
    ).join(' ');
  }
  const words = Array.from({ length: 160 }, (_, i) => WORDS[(seed + i * 7) % WORDS.length]);
  if (seed % 7 === 0) words[10] = SEARCHED;
  return `Stand-in text for piece ${n + 1}. ${words.join(' ')}.`;
};

/** A text for every piece of the shipped program that has any, keyed as texts.json is. */
export function standInTexts(): Record<string, string> {
  const structure = JSON.parse(readFileSync(STRUCTURE, 'utf8')) as Structure;
  const texts: Record<string, string> = {};
  for (const paper of papersOf(structure)) {
    [...paper.pieces].forEach((letter, n) => {
      if (letter !== 'x') texts[pieceId(paper.index, n)] = piece(paper.index, n, letter);
    });
  }
  return texts;
}
