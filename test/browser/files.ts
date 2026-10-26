// The data files the cases hold back, by the names the app gives them.
import { STRUCTURE_FILE, TEXTS_FILE } from '@torahmap/tanakh/verseTexts.ts';
import { DICTIONARY_FILES, SEARCH_FILES } from '@torahmap/tanakh/search/data.ts';
import { HAFTARAH_FILES } from '@torahmap/tanakh/overlays/haftarah/readings.ts';
import { SCORES_FILE } from '@torahmap/tanakh/overlays/text-analytics/scores.ts';

export { TEXTS_FILE };
export const DICTIONARY = Object.values(DICTIONARY_FILES);
/** The files search requires but the structure, which the map draws from. */
export const SEARCH_REQUIRED = Object.values(SEARCH_FILES).flatMap((file) =>
  typeof file === 'string' && file !== STRUCTURE_FILE ? [file] : [],
);
export const LEXICON = DICTIONARY_FILES.lexicon;
export const PARSE = SEARCH_FILES.parse.optional;
// As apps/tanakh/src/overlays/commentary.ts names it; that module imports CSS, which
// Playwright cannot load.
export const COMMENTARY = 'overlays/commentary/counts.json';
const HAFTARAH = HAFTARAH_FILES.mappings;
const TEXT_ANALYTICS = SCORES_FILE;
/** Every file but the structure. */
export const EVERYTHING = [TEXTS_FILE, ...DICTIONARY, PARSE, COMMENTARY, HAFTARAH, TEXT_ANALYTICS];
