// Trop (cantillation marks) extraction and indexing

// Unicode range for Hebrew cantillation marks: U+0591 - U+05AF
// Reference: https://unicode.org/charts/PDF/U0590.pdf

export interface TropMark {
  unicode: string;      // The Unicode character
  codePoint: number;    // Numeric code point
  name: string;         // English name
  hebrewName: string;   // Hebrew name
}

// All 27 trop marks with their names
// Ordered by traditional grouping, will be sorted by frequency later
export const TROP_MARKS: TropMark[] = [
  // Disjunctive accents (מפסיקים) - Emperors
  { unicode: '\u0592', codePoint: 0x0592, name: 'Segol', hebrewName: 'סגול' },
  { unicode: '\u0593', codePoint: 0x0593, name: 'Shalshelet', hebrewName: 'שלשלת' },
  { unicode: '\u0594', codePoint: 0x0594, name: 'Zaqef Qatan', hebrewName: 'זקף קטן' },
  { unicode: '\u0595', codePoint: 0x0595, name: 'Zaqef Gadol', hebrewName: 'זקף גדול' },
  { unicode: '\u0596', codePoint: 0x0596, name: 'Tipcha', hebrewName: 'טפחא' },
  { unicode: '\u0597', codePoint: 0x0597, name: 'Revia', hebrewName: 'רביע' },
  { unicode: '\u0598', codePoint: 0x0598, name: 'Zarqa', hebrewName: 'זרקא' },
  { unicode: '\u0599', codePoint: 0x0599, name: 'Pashta', hebrewName: 'פשטא' },
  { unicode: '\u059A', codePoint: 0x059A, name: 'Yetiv', hebrewName: 'יתיב' },
  { unicode: '\u059B', codePoint: 0x059B, name: 'Tevir', hebrewName: 'תביר' },
  { unicode: '\u059C', codePoint: 0x059C, name: 'Geresh', hebrewName: 'גרש' },
  { unicode: '\u059D', codePoint: 0x059D, name: 'Geresh Muqdam', hebrewName: 'גרש מוקדם' },
  { unicode: '\u059E', codePoint: 0x059E, name: 'Gershayim', hebrewName: 'גרשיים' },
  { unicode: '\u059F', codePoint: 0x059F, name: 'Karnei Parah', hebrewName: 'קרני פרה' },
  { unicode: '\u05A0', codePoint: 0x05A0, name: 'Telisha Gedola', hebrewName: 'תלישא גדולה' },
  { unicode: '\u05A1', codePoint: 0x05A1, name: 'Pazer', hebrewName: 'פזר' },
  // Conjunctive accents (משרתים)
  { unicode: '\u05A3', codePoint: 0x05A3, name: 'Munach', hebrewName: 'מונח' },
  { unicode: '\u05A4', codePoint: 0x05A4, name: 'Mahapakh', hebrewName: 'מהפך' },
  { unicode: '\u05A5', codePoint: 0x05A5, name: 'Merkha', hebrewName: 'מרכא' },
  { unicode: '\u05A6', codePoint: 0x05A6, name: 'Merkha Kefula', hebrewName: 'מרכא כפולה' },
  { unicode: '\u05A7', codePoint: 0x05A7, name: 'Darga', hebrewName: 'דרגא' },
  { unicode: '\u05A8', codePoint: 0x05A8, name: 'Qadma', hebrewName: 'קדמא' },
  { unicode: '\u05A9', codePoint: 0x05A9, name: 'Telisha Qetana', hebrewName: 'תלישא קטנה' },
  { unicode: '\u05AA', codePoint: 0x05AA, name: 'Yerah Ben Yomo', hebrewName: 'ירח בן יומו' },
  { unicode: '\u05AB', codePoint: 0x05AB, name: 'Ole', hebrewName: 'עולה' },
  { unicode: '\u05AC', codePoint: 0x05AC, name: 'Iluy', hebrewName: 'אילוי' },
  { unicode: '\u05AD', codePoint: 0x05AD, name: 'Dehi', hebrewName: 'דחי' },
  { unicode: '\u05AE', codePoint: 0x05AE, name: 'Zinor', hebrewName: 'זינור' },
  // Special
  { unicode: '\u0591', codePoint: 0x0591, name: 'Etnachta', hebrewName: 'אתנחתא' },
  { unicode: '\u05A2', codePoint: 0x05A2, name: 'Atnah Hafukh', hebrewName: 'אתנח הפוך' },
  { unicode: '\u05AF', codePoint: 0x05AF, name: 'Masora Circle', hebrewName: 'עיגול מסורה' },
];

// Create lookup map by unicode character
export const TROP_BY_UNICODE: Map<string, TropMark> = new Map(
  TROP_MARKS.map(t => [t.unicode, t])
);

// Rarity thresholds
export const RARITY_THRESHOLDS = {
  RARE: 50,       // < 50 occurrences = rare
  UNCOMMON: 500,  // 50-500 = uncommon
  // > 500 = common
};

export type RarityTier = 'rare' | 'uncommon' | 'common';

export function getRarityTier(count: number): RarityTier {
  if (count < RARITY_THRESHOLDS.RARE) return 'rare';
  if (count < RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  return 'common';
}

// Extract all trop marks from a Hebrew text string
export function extractTropMarks(hebrewText: string): string[] {
  const marks: string[] = [];
  for (const char of hebrewText) {
    const codePoint = char.codePointAt(0);
    if (codePoint && codePoint >= 0x0591 && codePoint <= 0x05AF) {
      marks.push(char);
    }
  }
  return marks;
}

// Count occurrences of each trop mark in text
export function countTropMarks(hebrewText: string): Map<string, number> {
  const counts = new Map<string, number>();
  const marks = extractTropMarks(hebrewText);
  for (const mark of marks) {
    counts.set(mark, (counts.get(mark) || 0) + 1);
  }
  return counts;
}
