// The data files the cases hold back, by the names the app gives them.
import { TEXTS_FILE } from '../src/verseTexts.ts';
import { DICTIONARY_FILES, SEARCH_FILES } from '../src/search/data.ts';
import { HAFTARAH_FILES } from '../src/overlays/haftarah/readings.ts';

export { TEXTS_FILE };
export const DICTIONARY = Object.values(DICTIONARY_FILES);
export const LEXICON = DICTIONARY_FILES.lexicon;
export const PARSE = SEARCH_FILES.parse.optional;
// As src/overlays/commentary.ts names it; that module imports CSS, which
// Playwright cannot load.
export const COMMENTARY = 'overlays/commentary/counts.json';
export const HAFTARAH = HAFTARAH_FILES.mappings;
/** Every file but the structure. */
export const EVERYTHING = [TEXTS_FILE, ...DICTIONARY, PARSE, COMMENTARY, HAFTARAH];
