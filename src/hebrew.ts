// The letter-level rules of Hebrew text: which characters are points and
// accents, which ones separate one word from the next, and how a written form
// is folded to the spelling the search index and the dictionary are keyed on.
//
// Everything that reads Hebrew reads it through here. Search, the clickable
// words in a verse and the highlighter in the results panel all have to agree
// about where a word ends; when they each had their own answer, a word could
// be found and then not highlighted.

// Points and accents share a Unicode range with four characters that are not
// decoration at all.
const NIKKUD_START = 0x0591;
const NIKKUD_END = 0x05c7;

// These sit inside the range above but separate words rather than sit on one.
// Sefaria ends every verse with a sof pasuq attached to the last word, so a
// rule that misses these loses that word.
const SEPARATOR_CODES = new Set([
  0x05be, // ־ maqaf, the hyphen joining two words into one accent unit
  0x05c0, // ׀ paseq, a light pause drawn between two words
  0x05c3, // ׃ sof pasuq, the colon ending a verse
  0x05c6, // ׆ nun hafukha, the inverted nun bracketing Numbers 10:35-36
]);

// U+034F COMBINING GRAPHEME JOINER. Sefaria writes ירושל͏ם with one inside the
// word, where it renders as nothing and matches nothing; without this, every
// lookup of Jerusalem misses.
const GRAPHEME_JOINER = 0x034f;

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
 * Does `stripNikkud` drop this character? A point, an accent, or the grapheme
 * joiner, none of which a reader types or sees.
 *
 * Mapping a position back to the text it came from counts exactly what this
 * dropped. The two disagreeing does not fail loudly: it shifts every highlight
 * after the disagreement along by one character, which looks plausible.
 *
 * Exported although only this module calls it. It is the one answer to what
 * counts as a point, and the three bugs that came of two rules drifting apart
 * all began with somewhere else writing its own. Anywhere that needs this test
 * should import it rather than spell it out again.
 */
export function isNikkud(code: number): boolean {
  if (code === GRAPHEME_JOINER) return true;
  return code >= NIKKUD_START && code <= NIKKUD_END && !SEPARATOR_CODES.has(code);
}

/** Whitespace, hyphen, or one of the four Hebrew characters that break words. */
export function isWordSeparator(char: string): boolean {
  return /\s/.test(char) || SEPARATOR_CODES.has(char.codePointAt(0)!) || char === '-';
}

/** Drop the points and accents, keeping final forms and separators as written. */
export function stripNikkud(text: string): string {
  let result = '';
  for (const char of text) {
    if (!isNikkud(char.charCodeAt(0))) result += char;
  }
  return result;
}

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
    const foldsToSpace = SEPARATOR_CODES.has(code) || char === '-';
    result += foldsToSpace ? ' ' : (FINAL_FORM_MAP[char] ?? char);
  }
  return result;
}

export interface TextWord {
  word: string;
  start: number;
  end: number;
}

/** The words of a piece of text, with where each one sits in that same text. */
export function splitIntoWords(text: string): TextWord[] {
  const words: TextWord[] = [];
  let start = 0;

  while (start < text.length) {
    while (start < text.length && isWordSeparator(text[start])) start++;
    if (start >= text.length) break;

    let end = start;
    while (end < text.length && !isWordSeparator(text[end])) end++;

    words.push({ word: text.slice(start, end), start, end });
    start = end;
  }

  return words;
}

/** Where a position in nikkud-stripped text falls in the text it came from. */
export function mapStrippedToOriginal(original: string, strippedPos: number): number {
  if (strippedPos < 0) return 0;

  let stripped = 0;
  for (let i = 0; i < original.length; i++) {
    if (stripped === strippedPos) return i;
    if (!isNikkud(original.charCodeAt(i))) stripped++;
  }
  return original.length;
}

/** How many points and accents sit within the next `strippedLen` letters. */
export function countNikkudInRange(text: string, start: number, strippedLen: number): number {
  if (start < 0 || start >= text.length || strippedLen < 0) return 0;

  let nikkud = 0;
  let letters = 0;
  for (let i = start; i < text.length && letters < strippedLen; i++) {
    if (isNikkud(text.charCodeAt(i))) nikkud++;
    else letters++;
  }
  return nikkud;
}
