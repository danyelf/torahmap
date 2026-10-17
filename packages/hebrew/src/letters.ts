// The letter-level rules of Hebrew text: which characters are points and
// accents, and which ones separate one word from the next.
//
// Everything that reads Hebrew finds its words through here, so that search,
// the clickable words in the popup and the highlighter agree about where a
// word ends.

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

/** Is this one of the four Hebrew characters above that break words? */
export function isHebrewSeparator(code: number): boolean {
  return SEPARATOR_CODES.has(code);
}

/**
 * Does `stripNikkud` drop this character? A point, an accent, or the grapheme
 * joiner, none of which a reader types or sees.
 *
 * Mapping a position back to the text it came from counts exactly what this
 * dropped. The two disagreeing does not fail loudly: it shifts every highlight
 * after the disagreement along by one character, which looks plausible.
 */
export function isNikkud(code: number): boolean {
  if (code === GRAPHEME_JOINER) return true;
  return code >= NIKKUD_START && code <= NIKKUD_END && !isHebrewSeparator(code);
}

const HEBREW_LETTER = /[\u05D0-\u05EA]/;

/** Does this text hold a Hebrew letter? */
export function isHebrew(text: string): boolean {
  return HEBREW_LETTER.test(text);
}

// The brackets Sefaria prints around a corrected word's two spellings. No
// bracket sits between two letters, so counting them as separators leaves
// every verse's words, and their line-up with BHSA, unchanged.
const BRACKETS = new Set(['(', ')', '[', ']']);

/** Whitespace, hyphen, a bracket, or one of the four Hebrew characters that break words. */
export function isWordSeparator(char: string): boolean {
  return (
    /\s/.test(char) || isHebrewSeparator(char.codePointAt(0)!) || char === '-' || BRACKETS.has(char)
  );
}

/** Is there nothing but word breaks between these two positions of the text? */
export function onlySeparators(text: string, from: number, to: number): boolean {
  return [...text.slice(from, to)].every(isWordSeparator);
}

/** Drop the points and accents, keeping final forms and separators as written. */
export function stripNikkud(text: string): string {
  let result = '';
  for (const char of text) {
    if (!isNikkud(char.charCodeAt(0))) result += char;
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
