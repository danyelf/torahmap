/**
 * Hebrew transliteration module
 * Maps English QWERTY keys to Hebrew letters according to the standard Hebrew keyboard layout
 */

// Standard Hebrew keyboard layout mapping (QWERTY to Hebrew)
// Based on the Israeli Standard SI 1452 keyboard layout
export const TRANSLITERATION_MAP: Record<string, string> = {
  // Top row (QWERTY) - q and w are punctuation in Hebrew layout
  q: '/', // slash
  w: "'", // apostrophe
  e: '\u05e7', // ק (qof)
  r: '\u05e8', // ר (resh)
  t: '\u05d0', // א (aleph)
  y: '\u05d8', // ט (tet)
  u: '\u05d5', // ו (vav)
  i: '\u05df', // ן (final nun)
  o: '\u05dd', // ם (final mem)
  p: '\u05e4', // פ (pe)

  // Middle row (ASDFGH...)
  a: '\u05e9', // ש (shin)
  s: '\u05d3', // ד (dalet)
  d: '\u05d2', // ג (gimel)
  f: '\u05db', // כ (kaf)
  g: '\u05e2', // ע (ayin)
  h: '\u05d9', // י (yod)
  j: '\u05d7', // ח (chet)
  k: '\u05dc', // ל (lamed)
  l: '\u05da', // ך (final kaf)

  // Bottom row (ZXCVBN...)
  z: '\u05d6', // ז (zayin)
  x: '\u05e1', // ס (samech)
  c: '\u05d1', // ב (bet)
  v: '\u05d4', // ה (he)
  b: '\u05e0', // נ (nun)
  n: '\u05de', // מ (mem)
  m: '\u05e6', // צ (tsadi)
};

// Reverse mapping: Hebrew to English
export const HEBREW_TO_ENGLISH: Record<string, string> = {};
for (const eng in TRANSLITERATION_MAP) {
  const heb = TRANSLITERATION_MAP[eng];
  HEBREW_TO_ENGLISH[heb] = eng;
}

/**
 * Transliterates English text to Hebrew using the standard keyboard layout
 * @param text - English text to transliterate
 * @returns Hebrew text
 */
export function transliterate(text: string): string {
  let result = '';
  for (const char of text) {
    const lower = char.toLowerCase();
    if (TRANSLITERATION_MAP[lower]) {
      result += TRANSLITERATION_MAP[lower];
    } else {
      // Preserve non-alphabetic characters (spaces, numbers, punctuation)
      result += char;
    }
  }
  return result;
}
