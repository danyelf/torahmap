/**
 * Hebrew transliteration module
 * Maps English letters to Hebrew letters using phonetic transliteration
 * Based on standard romanization (similar to Lexilogos)
 */

// Phonetic Hebrew transliteration mapping (English to Hebrew)
// Based on common romanization standards
export const TRANSLITERATION_MAP: Record<string, string> = {
  // Phonetic consonants (lowercase)
  a: '\u05d0', // א aleph
  b: '\u05d1', // ב bet
  g: '\u05d2', // ג gimel
  d: '\u05d3', // ד dalet
  h: '\u05d4', // ה he
  v: '\u05d5', // ו vav
  w: '\u05d5', // ו vav (alternate)
  z: '\u05d6', // ז zayin
  j: '\u05d7', // ח chet (phonetic j for 'ch' sound)
  u: '\u05d8', // ט tet
  y: '\u05d9', // י yod
  k: '\u05db', // כ kaf
  l: '\u05dc', // ל lamed
  m: '\u05de', // מ mem
  n: '\u05e0', // נ nun
  s: '\u05e1', // ס samech
  e: '\u05e2', // ע ayin (phonetic placeholder)
  p: '\u05e4', // פ pe
  f: '\u05e4', // פ pe (alternate)
  c: '\u05e6', // צ tsadi (phonetic 'ts' sound)
  q: '\u05e7', // ק qof
  r: '\u05e8', // ר resh
  x: '\u05e9', // ש shin (phonetic 'sh' sound)
  t: '\u05ea', // ת tav

  // No mappings for: i, o (these could be vowels in a full system)
};

// Reverse mapping: Hebrew to English
export const HEBREW_TO_ENGLISH: Record<string, string> = {};
for (const eng in TRANSLITERATION_MAP) {
  const heb = TRANSLITERATION_MAP[eng];
  // Only store first occurrence to avoid duplicates (v/w, p/f, etc.)
  if (!HEBREW_TO_ENGLISH[heb]) {
    HEBREW_TO_ENGLISH[heb] = eng;
  }
}

/**
 * Transliterates English text to Hebrew using phonetic mapping
 * @param text - English text to transliterate
 * @returns Hebrew text
 */
export function transliterate(text: string): string {
  let result = '';
  for (const char of text) {
    const lower = char.toLowerCase();
    if (TRANSLITERATION_MAP[lower]) {
      result += TRANSLITERATION_MAP[lower];
    } else if (!/[a-z]/i.test(char)) {
      // Preserve non-alphabetic characters (spaces, numbers, punctuation)
      // Drop unmapped letters (vowels i, o)
      result += char;
    }
  }
  return result;
}
