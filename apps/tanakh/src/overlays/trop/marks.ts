// Trop (cantillation marks): what the marks are, and which verses carry them.
//
// The domain half of the trop feature. The overlay that draws it is in
// ../trop.ts.

import type { VerseTexts } from '../../verseTexts.ts';

// The cantillation marks open the Hebrew points-and-accents block, so every
// one is also something the shell's isNikkud strips; the vowel points after
// them are not trop.
const TROP_START = 0x0591;
const TROP_END = 0x05af;

/** Is this one of the cantillation marks, the accents that say how a verse is chanted? */
function isTropMark(code: number): boolean {
  return code >= TROP_START && code <= TROP_END;
}

// Trop index: maps trop unicode -> list of verse locations containing it
interface TropVerseLocation {
  book: string;
  chapter: number;
  verse: number;
  count: number; // How many times this trop appears in this verse
}

export interface TropMark {
  unicode: string; // The Unicode character
  name: string; // English name
  hebrewName: string; // Hebrew name
  /**
   * How strongly a disjunctive mark divides a prose verse, 1 strongest; absent
   * for the rest. The end of a verse, silluq, outranks them all and is no mark.
   */
  rank?: 1 | 2 | 3 | 4;
}

export interface TropIndexEntry extends TropMark {
  totalCount: number;
  verses: TropVerseLocation[];
}

export type TropIndex = Map<string, TropIndexEntry>;

// The trop marks, with their names, ordered by traditional grouping.
export const TROP_MARKS: TropMark[] = [
  // Disjunctive accents (מפסיקים) - Emperors
  { unicode: '\u0592', name: 'Segol', hebrewName: 'סגול', rank: 2 },
  { unicode: '\u0593', name: 'Shalshelet', hebrewName: 'שלשלת', rank: 2 },
  { unicode: '\u0594', name: 'Zaqef Qatan', hebrewName: 'זקף קטן', rank: 2 },
  { unicode: '\u0595', name: 'Zaqef Gadol', hebrewName: 'זקף גדול', rank: 2 },
  { unicode: '\u0596', name: 'Tipcha', hebrewName: 'טפחא', rank: 2 },
  { unicode: '\u0597', name: 'Revia', hebrewName: 'רביע', rank: 3 },
  // Zinor is the zarqa of the prose books, the pause before a segol. Zarqa, the
  // other code point, is written beside it on the same word to mark the stress;
  // alone it occurs only in Psalms, Proverbs and Job.
  { unicode: '\u05AE', name: 'Zinor', hebrewName: 'זינור', rank: 3 },
  { unicode: '\u0598', name: 'Zarqa', hebrewName: 'זרקא' },
  { unicode: '\u0599', name: 'Pashta', hebrewName: 'פשטא', rank: 3 },
  { unicode: '\u059A', name: 'Yetiv', hebrewName: 'יתיב', rank: 3 },
  { unicode: '\u059B', name: 'Tevir', hebrewName: 'תביר', rank: 3 },
  { unicode: '\u059C', name: 'Geresh', hebrewName: 'גרש', rank: 4 },
  { unicode: '\u059D', name: 'Geresh Muqdam', hebrewName: 'גרש מוקדם', rank: 4 },
  { unicode: '\u059E', name: 'Gershayim', hebrewName: 'גרשיים', rank: 4 },
  { unicode: '\u059F', name: 'Karnei Parah', hebrewName: 'קרני פרה', rank: 4 },
  { unicode: '\u05A0', name: 'Telisha Gedola', hebrewName: 'תלישא גדולה', rank: 4 },
  { unicode: '\u05A1', name: 'Pazer', hebrewName: 'פזר', rank: 4 },
  // Conjunctive accents (משרתים)
  { unicode: '\u05A3', name: 'Munach', hebrewName: 'מונח' },
  { unicode: '\u05A4', name: 'Mahapakh', hebrewName: 'מהפך' },
  { unicode: '\u05A5', name: 'Merkha', hebrewName: 'מרכא' },
  { unicode: '\u05A6', name: 'Merkha Kefula', hebrewName: 'מרכא כפולה' },
  { unicode: '\u05A7', name: 'Darga', hebrewName: 'דרגא' },
  { unicode: '\u05A8', name: 'Qadma', hebrewName: 'קדמא' },
  { unicode: '\u05A9', name: 'Telisha Qetana', hebrewName: 'תלישא קטנה' },
  { unicode: '\u05AA', name: 'Yerah Ben Yomo', hebrewName: 'ירח בן יומו' },
  { unicode: '\u05AB', name: 'Ole', hebrewName: 'עולה' },
  { unicode: '\u05AC', name: 'Iluy', hebrewName: 'אילוי' },
  { unicode: '\u05AD', name: 'Dehi', hebrewName: 'דחי' },
  // Special
  { unicode: '\u0591', name: 'Etnachta', hebrewName: 'אתנחתא', rank: 1 },
  { unicode: '\u05A2', name: 'Atnah Hafukh', hebrewName: 'אתנח הפוך' },
  { unicode: '\u05AF', name: 'Masora Circle', hebrewName: 'עיגול מסורה' },
];

// By occurrences across the Tanakh. The rare marks run to Yerah Ben Yomo at 55
// and the next is Iluy at 184, so any RARE between them leaves the same four rare.
export const RARITY_THRESHOLDS = {
  RARE: 100,
  UNCOMMON: 500,
};

export type RarityTier = 'rare' | 'uncommon' | 'common';

export function getRarityTier(count: number): RarityTier {
  if (count < RARITY_THRESHOLDS.RARE) return 'rare';
  if (count < RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  return 'common';
}

function extractTropMarks(hebrewText: string): string[] {
  const marks: string[] = [];
  for (const char of hebrewText) {
    const codePoint = char.codePointAt(0);
    if (codePoint && isTropMark(codePoint)) {
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

  for (const trop of TROP_MARKS) {
    index.set(trop.unicode, {
      unicode: trop.unicode,
      name: trop.name,
      hebrewName: trop.hebrewName,
      totalCount: 0,
      verses: [],
    });
  }

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
    .filter((entry) => entry.totalCount > 0) // Only include marks that appear
    .sort((a, b) => a.totalCount - b.totalCount);
}
