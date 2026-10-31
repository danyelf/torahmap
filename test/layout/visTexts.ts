// Made-up paper text for the VIS states: the real papers are copyright, so they stay out of git
// and out of screenshots.
import { readFileSync } from 'node:fs';
import type { Structure } from '@torahmap/ieeevis/data.ts';
import { computeLayout } from '@torahmap/ieeevis/layout.ts';
import { isPlaceholder } from '@torahmap/ieeevis/baseColor.ts';

const STRUCTURE = new URL('../../public/data/ieeevis/structure.json', import.meta.url);
const WORDS = ['chart', 'colour', 'axis', 'glyph', 'mark', 'scale', 'layout', 'filter', 'trend'];
const REFERENCE_COUNT = 12;
const WORDS_PER_PIECE = 160;
/** Every seventh piece carries it, for the states that search. */
export const SEARCHED = 'drucker';
const SEARCHED_EVERY = 7;

/** A piece of a reference list that cites a real work, for the states that mark cited references. */
export const CITING = {
  id: '252.40',
  entry:
    'K. Wongsuphasawat, D. Moritz (2016) Voyager: Exploratory analysis via faceted browsing of visualization recommendations. TVCG.',
};

// A reference list's entries are numbered "[n] ", which is how the popup splits them into lines.
const references = (id: string): string =>
  Array.from(
    { length: REFERENCE_COUNT },
    (_, i) =>
      `[${i + 1}] ${id === CITING.id && i === 5 ? CITING.entry : `Author A. Stand-in reference ${i}.`}`,
  ).join(' ');

const prose = (id: string, piece: number, seed: number): string => {
  const words = Array.from(
    { length: WORDS_PER_PIECE },
    (_, i) => WORDS[(seed + i * SEARCHED_EVERY) % WORDS.length],
  );
  if (seed % SEARCHED_EVERY === 0) words[0] = SEARCHED;
  return `Stand-in text for piece ${piece + 1} (${id}). ${words.join(' ')}.`;
};

/** A text for every piece of the shipped program that has any, keyed as texts.json is, before packing. */
export function standInTexts(): Record<string, string> {
  const structure = JSON.parse(readFileSync(STRUCTURE, 'utf8')) as Structure;
  const texts: Record<string, string> = {};
  computeLayout(structure).items.forEach((item, seed) => {
    if (isPlaceholder(item)) return;
    texts[item.id] = item.section === 'f' ? references(item.id) : prose(item.id, item.piece, seed);
  });
  return texts;
}
