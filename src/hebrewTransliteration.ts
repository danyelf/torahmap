/**
 * Hebrew transliteration module
 * Maps English QWERTY keys to Hebrew letters according to the standard Hebrew keyboard layout
 * with final forms replaced by regular forms
 */

// Standard Hebrew keyboard layout mapping (QWERTY to Hebrew)
// Based on the Israeli Standard SI 1452 keyboard layout, with final forms removed
export const TRANSLITERATION_MAP: Record<string, string> = {
  // Top row (QWERTY)
  q: '/', // slash (punctuation)
  w: "'", // apostrophe (punctuation)
  e: '\u05e7', // ק (qof)
  r: '\u05e8', // ר (resh)
  t: '\u05d0', // א (aleph)
  y: '\u05d8', // ט (tet)
  u: '\u05d5', // ו (vav)
  i: '\u05e0', // נ (nun) - standard has final nun ן, using regular form
  o: '\u05de', // מ (mem) - standard has final mem ם, using regular form
  p: '\u05e4', // פ (pe)

  // Middle row (ASDFGHJKL)
  a: '\u05e9', // ש (shin)
  s: '\u05d3', // ד (dalet)
  d: '\u05d2', // ג (gimel)
  f: '\u05db', // כ (kaf)
  g: '\u05e2', // ע (ayin)
  h: '\u05d9', // י (yod)
  j: '\u05d7', // ח (chet)
  k: '\u05dc', // ל (lamed)
  l: '\u05db', // כ (kaf) - standard has final kaf ך, using regular form (same as f)

  // Bottom row (ZXCVBNM)
  z: '\u05d6', // ז (zayin)
  x: '\u05e1', // ס (samech)
  c: '\u05d1', // ב (bet)
  v: '\u05d4', // ה (he)
  b: '\u05e0', // נ (nun) - standard layout
  n: '\u05de', // מ (mem) - standard layout
  m: '\u05e6', // צ (tsadi)
};

// Reverse mapping: Hebrew to English
// Note: Multiple keys can map to same Hebrew letter (i/b→nun, o/n→mem, f/l→kaf)
export const HEBREW_TO_ENGLISH: Record<string, string> = {};
for (const eng in TRANSLITERATION_MAP) {
  const heb = TRANSLITERATION_MAP[eng];
  // Only store first occurrence to avoid duplicates
  if (!HEBREW_TO_ENGLISH[heb]) {
    HEBREW_TO_ENGLISH[heb] = eng;
  }
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
