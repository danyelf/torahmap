// How a written form is folded to the spelling the search index and the
// dictionary are keyed on.

import { isHebrewSeparator, isNikkud } from '@torahmap/shell/hebrew.ts';

// Shin and sin written as one character each, from the Hebrew presentation
// forms. BHSA uses these where Sefaria writes the plain letter and a dot, and
// the dot is stripped as a point, so the two sources would otherwise disagree
// about how to spell the same word. Nothing in the text we display uses them;
// the generator folds them for the same reason, and both fold both so that
// neither has to be read to predict the other.
const PRESENTATION_FORM_MAP: Record<string, string> = {
  'שׁ': 'ש', // shin with shin dot (U+FB2A) → shin (U+05E9)
  'שׂ': 'ש', // shin with sin dot (U+FB2B) → shin (U+05E9)
};

const FINAL_FORM_MAP: Record<string, string> = {
  'ך': 'כ', // kaf sofit (U+05DA) → kaf (U+05DB)
  'ם': 'מ', // mem sofit (U+05DD) → mem (U+05DE)
  'ן': 'נ', // nun sofit (U+05DF) → nun (U+05E0)
  'ף': 'פ', // pe sofit (U+05E3) → pe (U+05E4)
  'ץ': 'צ', // tzadi sofit (U+05E5) → tzadi (U+05E6)
};

/**
 * The spelling a word is indexed and searched under: points and accents gone,
 * final forms folded to their plain letters, and every separator written as a
 * space so that a typed space matches a maqaf.
 */
export function normalizeHebrewForSearch(text: string): string {
  let result = '';
  for (const raw of text) {
    const char = PRESENTATION_FORM_MAP[raw] ?? raw;
    const code = char.charCodeAt(0);
    if (isNikkud(code)) continue;
    // Whitespace is already a break and is left as written; it is the Hebrew
    // separators that have to become one, so that a typed space matches them.
    const foldsToSpace = isHebrewSeparator(code) || char === '-';
    result += foldsToSpace ? ' ' : (FINAL_FORM_MAP[char] ?? char);
  }
  return result;
}
