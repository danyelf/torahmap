// Trop (cantillation marks) extraction and indexing

import type { TropIndex, TropIndexEntry } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';

// Unicode range for Hebrew cantillation marks: U+0591 - U+05AF
// Reference: https://unicode.org/charts/PDF/U0590.pdf

export interface TropMark {
  unicode: string;      // The Unicode character
  name: string;         // English name
  hebrewName: string;   // Hebrew name
}

// All 27 trop marks with their names
// Ordered by traditional grouping, will be sorted by frequency later
export const TROP_MARKS: TropMark[] = [
  // Disjunctive accents (מפסיקים) - Emperors
  { unicode: '\u0592',name: 'Segol', hebrewName: 'סגול' },
  { unicode: '\u0593',name: 'Shalshelet', hebrewName: 'שלשלת' },
  { unicode: '\u0594',name: 'Zaqef Qatan', hebrewName: 'זקף קטן' },
  { unicode: '\u0595',name: 'Zaqef Gadol', hebrewName: 'זקף גדול' },
  { unicode: '\u0596',name: 'Tipcha', hebrewName: 'טפחא' },
  { unicode: '\u0597',name: 'Revia', hebrewName: 'רביע' },
  { unicode: '\u0598',name: 'Zarqa', hebrewName: 'זרקא' },
  { unicode: '\u0599',name: 'Pashta', hebrewName: 'פשטא' },
  { unicode: '\u059A',name: 'Yetiv', hebrewName: 'יתיב' },
  { unicode: '\u059B',name: 'Tevir', hebrewName: 'תביר' },
  { unicode: '\u059C',name: 'Geresh', hebrewName: 'גרש' },
  { unicode: '\u059D',name: 'Geresh Muqdam', hebrewName: 'גרש מוקדם' },
  { unicode: '\u059E',name: 'Gershayim', hebrewName: 'גרשיים' },
  { unicode: '\u059F',name: 'Karnei Parah', hebrewName: 'קרני פרה' },
  { unicode: '\u05A0',name: 'Telisha Gedola', hebrewName: 'תלישא גדולה' },
  { unicode: '\u05A1',name: 'Pazer', hebrewName: 'פזר' },
  // Conjunctive accents (משרתים)
  { unicode: '\u05A3',name: 'Munach', hebrewName: 'מונח' },
  { unicode: '\u05A4',name: 'Mahapakh', hebrewName: 'מהפך' },
  { unicode: '\u05A5',name: 'Merkha', hebrewName: 'מרכא' },
  { unicode: '\u05A6',name: 'Merkha Kefula', hebrewName: 'מרכא כפולה' },
  { unicode: '\u05A7',name: 'Darga', hebrewName: 'דרגא' },
  { unicode: '\u05A8',name: 'Qadma', hebrewName: 'קדמא' },
  { unicode: '\u05A9',name: 'Telisha Qetana', hebrewName: 'תלישא קטנה' },
  { unicode: '\u05AA',name: 'Yerah Ben Yomo', hebrewName: 'ירח בן יומו' },
  { unicode: '\u05AB',name: 'Ole', hebrewName: 'עולה' },
  { unicode: '\u05AC',name: 'Iluy', hebrewName: 'אילוי' },
  { unicode: '\u05AD',name: 'Dehi', hebrewName: 'דחי' },
  { unicode: '\u05AE',name: 'Zinor', hebrewName: 'זינור' },
  // Special
  { unicode: '\u0591',name: 'Etnachta', hebrewName: 'אתנחתא' },
  { unicode: '\u05A2',name: 'Atnah Hafukh', hebrewName: 'אתנח הפוך' },
  { unicode: '\u05AF',name: 'Masora Circle', hebrewName: 'עיגול מסורה' },
];

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
function extractTropMarks(hebrewText: string): string[] {
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
function countTropMarks(hebrewText: string): Map<string, number> {
  const counts = new Map<string, number>();
  const marks = extractTropMarks(hebrewText);
  for (const mark of marks) {
    counts.set(mark, (counts.get(mark) || 0) + 1);
  }
  return counts;
}

// Build complete trop index from all verse texts
export function buildTropIndex(verseTexts: VerseTexts): TropIndex {
  const index: TropIndex = new Map();

  // Initialize entries for all known trop marks
  for (const trop of TROP_MARKS) {
    index.set(trop.unicode, {
      unicode: trop.unicode,
      name: trop.name,
      hebrewName: trop.hebrewName,
      totalCount: 0,
      verses: [],
    });
  }

  // Scan all verses
  for (const [book, chapters] of Object.entries(verseTexts)) {
    for (const [chapterStr, verses] of Object.entries(chapters)) {
      const chapter = parseInt(chapterStr, 10);
      for (const [verseStr, text] of Object.entries(verses)) {
        const verse = parseInt(verseStr, 10);
        const counts = countTropMarks(text.he);

        for (const [unicode, count] of counts) {
          const entry = index.get(unicode);
          if (entry) {
            entry.totalCount += count;
            entry.verses.push({ book, chapter, verse, count });
          }
        }
      }
    }
  }

  return index;
}

// Get trop marks sorted by frequency (rarest first)
export function getTropByFrequency(index: TropIndex): TropIndexEntry[] {
  return Array.from(index.values())
    .filter(entry => entry.totalCount > 0)  // Only include marks that appear
    .sort((a, b) => a.totalCount - b.totalCount);
}
