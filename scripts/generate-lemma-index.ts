/**
 * Generate lemma index from morphhb for Hebrew search canonicalization
 *
 * Outputs:
 * 1. verse-lemmas.json: Map of verse key -> array of Strong's numbers
 * 2. word-lemmas.json: Map of Hebrew word (no nikkud) -> array of Strong's numbers
 * 3. strongs-to-root.json: Map of Strong's number -> canonical Hebrew root (no nikkud)
 *
 * Note: morphhb and Sefaria use different verse numbering for ~140 chapters
 * (Psalms superscriptions, chapter boundary shifts, Ten Commandments splitting).
 * This script matches morphhb verses to Sefaria verses by comparing Hebrew text
 * so that verse-lemmas.json keys align with the Sefaria-based all-texts.json keys.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// morphhb is a CommonJS module, need to use require
const require = createRequire(import.meta.url);
// @ts-ignore - morphhb doesn't have types
const morphhb = require('morphhb');

// Load Sefaria texts for verse number alignment
const sefariaTexts: Record<string, Record<string, Record<string, { he: string; en: string }>>> =
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'all-texts.json'), 'utf-8'));

// Book name mapping from morphhb to our internal names
const BOOK_NAME_MAP: Record<string, string> = {
  'Genesis': 'Genesis',
  'Exodus': 'Exodus',
  'Leviticus': 'Leviticus',
  'Numbers': 'Numbers',
  'Deuteronomy': 'Deuteronomy',
  'Joshua': 'Joshua',
  'Judges': 'Judges',
  'I Samuel': 'I Samuel',
  'II Samuel': 'II Samuel',
  'I Kings': 'I Kings',
  'II Kings': 'II Kings',
  'Isaiah': 'Isaiah',
  'Jeremiah': 'Jeremiah',
  'Ezekiel': 'Ezekiel',
  'Hosea': 'Hosea',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obadiah': 'Obadiah',
  'Jonah': 'Jonah',
  'Micah': 'Micah',
  'Nahum': 'Nahum',
  'Habakkuk': 'Habakkuk',
  'Zephaniah': 'Zephaniah',
  'Haggai': 'Haggai',
  'Zechariah': 'Zechariah',
  'Malachi': 'Malachi',
  'Psalms': 'Psalms',
  'Proverbs': 'Proverbs',
  'Job': 'Job',
  'Song of Solomon': 'Song of Songs',
  'Ruth': 'Ruth',
  'Lamentations': 'Lamentations',
  'Ecclesiastes': 'Ecclesiastes',
  'Esther': 'Esther',
  'Daniel': 'Daniel',
  'Ezra': 'Ezra',
  'Nehemiah': 'Nehemiah',
  'I Chronicles': 'I Chronicles',
  'II Chronicles': 'II Chronicles',
};

// Nikkud (vowel marks) range
const NIKKUD_START = 0x0591;
const NIKKUD_END = 0x05C7;

// Hebrew final forms (sofit) - map final form to regular (medial) form
const FINAL_FORM_MAP: Record<string, string> = {
  'ך': 'כ', // kaf sofit
  'ם': 'מ', // mem sofit
  'ן': 'נ', // nun sofit
  'ף': 'פ', // pe sofit
  'ץ': 'צ', // tzadi sofit
};

/**
 * Normalize Hebrew text for search: strip nikkud AND convert final forms to medial.
 * All keys in word-lemmas and values in strongs-to-root use medial forms only,
 * matching what the keyboard emits.
 */
function normalizeHebrew(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip nikkud marks but keep Hebrew letters and other characters
    if (code < NIKKUD_START || code > NIKKUD_END || code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6) {
      result += FINAL_FORM_MAP[char] || char;
    }
  }
  return result;
}

/**
 * Strip Hebrew text to bare letters only (no nikkud, cantillation, or punctuation).
 * Used for comparing morphhb text against Sefaria text to align verse numbering.
 */
function stripToLetters(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Keep only Hebrew letters (U+05D0-U+05EA)
    if (code >= 0x05D0 && code <= 0x05EA) {
      result += char;
    }
    // Convert maqaf (U+05BE) and spaces to space
    else if (char === ' ' || code === 0x05BE) {
      result += ' ';
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Reconstruct plain Hebrew text from a morphhb verse (strip nikkud and segmentation marks)
 */
function morphhbVerseToText(verse: string[][]): string {
  return verse.map((word: string[]) => stripToLetters(word[0].replace(/\//g, ''))).join(' ');
}

// chapter → (signature → verse numbers[])
type ChapterSigLookup = Map<number, Map<string, number[]>>;

/**
 * Build text signature lookups for a Sefaria book at multiple word lengths.
 * Stores arrays of verse numbers per signature to handle collisions
 * (e.g., Genesis 1 where "ויהי ערב ויהי בקר יום" repeats 6 times).
 */
function buildSefariaLookups(bookName: string): Record<number, ChapterSigLookup> {
  const lookups: Record<number, ChapterSigLookup> = {};
  for (const n of [5, 4, 3]) {
    lookups[n] = new Map();
  }

  const bookData = sefariaTexts[bookName];
  if (!bookData) return lookups;

  for (const ch of Object.keys(bookData)) {
    const chNum = parseInt(ch);
    for (const n of [5, 4, 3]) {
      if (!lookups[n].has(chNum)) lookups[n].set(chNum, new Map());
    }
    for (const v of Object.keys(bookData[ch])) {
      const heText = bookData[ch][v].he;
      if (!heText) continue;
      const stripped = stripToLetters(heText);
      const words = stripped.split(' ');
      for (const n of [5, 4, 3]) {
        if (words.length >= n) {
          const sig = words.slice(0, n).join(' ');
          const chMap = lookups[n].get(chNum)!;
          const existing = chMap.get(sig);
          if (existing) {
            existing.push(parseInt(v));
          } else {
            chMap.set(sig, [parseInt(v)]);
          }
        }
      }
    }
  }
  return lookups;
}

/**
 * Find the Sefaria verse key that matches a morphhb verse by comparing text.
 * Tries progressively shorter signatures (5, 4, 3 words) and searches
 * within ±2 chapters of the expected position.
 * When multiple Sefaria verses share the same signature (e.g., repeated formulae),
 * picks the one closest to the morphhb verse number.
 * Returns the matched "book:chapter:verse" key, or null if no match found.
 */
function findSefariaVerseKey(
  lookups: Record<number, ChapterSigLookup>,
  morphhbText: string,
  morphhbChapter: number,
  morphhbVerse: number,
  bookName: string
): string | null {
  const words = morphhbText.split(' ');

  for (const sigLen of [5, 4, 3]) {
    if (words.length < sigLen) continue;
    const sig = words.slice(0, sigLen).join(' ');
    const lookup = lookups[sigLen];

    // Search same chapter first, then adjacent chapters
    for (const chOffset of [0, -1, 1, -2, 2]) {
      const targetCh = morphhbChapter + chOffset;
      const chMap = lookup.get(targetCh);
      if (!chMap) continue;

      const candidates = chMap.get(sig);
      if (candidates && candidates.length > 0) {
        // Pick the candidate closest to the expected verse number
        let bestV = candidates[0];
        let bestDist = Math.abs(candidates[0] - morphhbVerse);
        for (let i = 1; i < candidates.length; i++) {
          const dist = Math.abs(candidates[i] - morphhbVerse);
          if (dist < bestDist) {
            bestV = candidates[i];
            bestDist = dist;
          }
        }
        return `${bookName}:${targetCh}:${bestV}`;
      }
    }
  }

  return null;
}

/**
 * Extract Strong's number from morphhb encoding
 * Examples: "H1234" -> "1234", "Hc/H1234" -> "1234"
 */
function extractStrongsNumber(strongsField: string): string | null {
  const match = strongsField.match(/H(\d+)/);
  return match ? match[1] : null;
}

/**
 * Psalms where morphhb combines superscription + first verse into a single verse 1.
 * splitAt = lemma index where superscription ends and real verse begins.
 * diff = 1: morphhb v1 → Sefaria v1 (superscription) + v2 (real verse)
 * diff = 2: morphhb v1 → Sefaria v2 + v3 (Sefaria v1 is text-only header, no morphhb data)
 */
const PSALM_SUPERSCRIPTION_SPLITS: Record<number, { splitAt: number; diff: number }> = {
  3:   { splitAt: 6,  diff: 1 },
  4:   { splitAt: 4,  diff: 1 },
  5:   { splitAt: 5,  diff: 1 },
  6:   { splitAt: 6,  diff: 1 },
  7:   { splitAt: 10, diff: 1 },
  8:   { splitAt: 5,  diff: 1 },
  9:   { splitAt: 5,  diff: 1 },
  12:  { splitAt: 5,  diff: 1 },
  18:  { splitAt: 20, diff: 1 },
  19:  { splitAt: 3,  diff: 1 },
  20:  { splitAt: 3,  diff: 1 },
  21:  { splitAt: 3,  diff: 1 },
  22:  { splitAt: 6,  diff: 1 },
  30:  { splitAt: 5,  diff: 1 },
  31:  { splitAt: 3,  diff: 1 },
  34:  { splitAt: 8,  diff: 1 },
  36:  { splitAt: 4,  diff: 1 },
  38:  { splitAt: 3,  diff: 1 },
  39:  { splitAt: 5,  diff: 1 },
  40:  { splitAt: 3,  diff: 1 },
  41:  { splitAt: 3,  diff: 1 },
  42:  { splitAt: 4,  diff: 1 },
  44:  { splitAt: 4,  diff: 1 },
  45:  { splitAt: 8,  diff: 1 },
  46:  { splitAt: 6,  diff: 1 },
  47:  { splitAt: 4,  diff: 1 },
  48:  { splitAt: 4,  diff: 1 },
  49:  { splitAt: 4,  diff: 1 },
  51:  { splitAt: 9,  diff: 2 },
  52:  { splitAt: 11, diff: 2 },
  53:  { splitAt: 5,  diff: 1 },
  54:  { splitAt: 8,  diff: 2 },
  55:  { splitAt: 4,  diff: 1 },
  56:  { splitAt: 11, diff: 1 },
  57:  { splitAt: 9,  diff: 1 },
  58:  { splitAt: 5,  diff: 1 },
  59:  { splitAt: 11, diff: 1 },
  60:  { splitAt: 17, diff: 2 },
  61:  { splitAt: 4,  diff: 1 },
  62:  { splitAt: 5,  diff: 1 },
  63:  { splitAt: 5,  diff: 1 },
  64:  { splitAt: 3,  diff: 1 },
  65:  { splitAt: 4,  diff: 1 },
  67:  { splitAt: 4,  diff: 1 },
  68:  { splitAt: 4,  diff: 1 },
  69:  { splitAt: 4,  diff: 1 },
  70:  { splitAt: 3,  diff: 1 },
  75:  { splitAt: 6,  diff: 1 },
  76:  { splitAt: 5,  diff: 1 },
  77:  { splitAt: 6,  diff: 1 },
  80:  { splitAt: 6,  diff: 1 },
  81:  { splitAt: 4,  diff: 1 },
  83:  { splitAt: 3,  diff: 1 },
  84:  { splitAt: 6,  diff: 1 },
  85:  { splitAt: 4,  diff: 1 },
  88:  { splitAt: 11, diff: 1 },
  89:  { splitAt: 3,  diff: 1 },
  92:  { splitAt: 4,  diff: 1 },
  102: { splitAt: 8,  diff: 1 },
  108: { splitAt: 3,  diff: 1 },
  140: { splitAt: 3,  diff: 1 },
  142: { splitAt: 5,  diff: 1 },
};

interface VerseLemmas {
  [verseKey: string]: string[]; // verse key -> array of Strong's numbers
}

interface WordLemmas {
  [word: string]: Set<string>; // Hebrew word (no nikkud/prefixes) -> Set of Strong's numbers
}

interface StrongsToRoot {
  [strongsNum: string]: string; // Strong's number -> canonical Hebrew root
}

const verseLemmas: VerseLemmas = {};
const wordLemmas: WordLemmas = {};
const strongsToRoot: StrongsToRoot = {};

console.log('Building lemma index from morphhb...');

let totalVerses = 0;
let totalWords = 0;
let remappedVerses = 0;
let unmatchedVerses = 0;

for (const bookName of Object.keys(morphhb)) {
  const ourBookName = BOOK_NAME_MAP[bookName];
  if (!ourBookName) {
    console.warn(`Warning: No mapping for book "${bookName}"`);
    continue;
  }

  const book = morphhb[bookName];
  const sefariaLookups = buildSefariaLookups(ourBookName);

  for (let chapterIdx = 0; chapterIdx < book.length; chapterIdx++) {
    const chapter = book[chapterIdx];
    const morphhbChapter = chapterIdx + 1;

    for (let verseIdx = 0; verseIdx < chapter.length; verseIdx++) {
      const verse = chapter[verseIdx];
      const morphhbVerse = verseIdx + 1;
      const morphhbKey = `${ourBookName}:${morphhbChapter}:${morphhbVerse}`;

      // Match morphhb verse text against Sefaria to find the correct verse key
      const morphhbText = morphhbVerseToText(verse);
      const sefariaKey = findSefariaVerseKey(sefariaLookups, morphhbText, morphhbChapter, morphhbVerse, ourBookName);
      const verseKey = sefariaKey || morphhbKey;

      if (sefariaKey && sefariaKey !== morphhbKey) {
        remappedVerses++;
      } else if (!sefariaKey) {
        unmatchedVerses++;
      }

      const lemmas: string[] = [];

      for (const word of verse) {
        const [hebrewWord, strongsField, morph] = word;
        const strongsNum = extractStrongsNumber(strongsField);

        if (strongsNum) {
          lemmas.push(strongsNum);
          totalWords++;

          // Extract root Hebrew word (remove prefixes/suffixes marked with /)
          // Example: "ו/ה/ארץ" -> ["ו", "ה", "ארץ"], we want the last part
          const parts = hebrewWord.split('/');
          const rootWord = normalizeHebrew(parts[parts.length - 1]);

          // Store the canonical root for this Strong's number
          // Ignore very short forms (1-2 chars) which are typically just suffixes/prefixes
          // Among longer forms, prefer shorter (more canonical) roots
          if (rootWord.length >= 3) {
            if (!strongsToRoot[strongsNum] || rootWord.length < strongsToRoot[strongsNum].length) {
              strongsToRoot[strongsNum] = rootWord;
            }
          }

          // Store the full word (all parts joined) for exact matching
          // This handles cases like "עבדיו" where morphhb has "עבדי/ו"
          const fullWord = normalizeHebrew(parts.join(''));
          if (fullWord.length >= 2) {
            if (!wordLemmas[fullWord]) {
              wordLemmas[fullWord] = new Set();
            }
            wordLemmas[fullWord].add(strongsNum);
          }

          // Also store each part that could be searched
          for (const part of parts) {
            const stripped = normalizeHebrew(part);
            if (stripped.length >= 2) { // Skip single-letter prefixes
              if (!wordLemmas[stripped]) {
                wordLemmas[stripped] = new Set();
              }
              wordLemmas[stripped].add(strongsNum);
            }
          }
        }
      }

      // Psalms superscription splitting: morphhb combines superscription + first verse
      // into a single verse 1, but Sefaria splits them into separate verses.
      const psalmSplit = ourBookName === 'Psalms' && morphhbVerse === 1
        ? PSALM_SUPERSCRIPTION_SPLITS[morphhbChapter]
        : undefined;

      if (psalmSplit) {
        const { splitAt, diff } = psalmSplit;
        const superLemmas = lemmas.slice(0, splitAt);
        const verseLemmasArr = lemmas.slice(splitAt);
        // diff=1: superscription → v1, real verse → v2
        // diff=2: superscription → v2, real verse → v3 (v1 is text-only header)
        const superKey = `${ourBookName}:${morphhbChapter}:${diff === 1 ? 1 : 2}`;
        const verseKeyForReal = `${ourBookName}:${morphhbChapter}:${diff === 1 ? 2 : 3}`;
        verseLemmas[superKey] = superLemmas;
        verseLemmas[verseKeyForReal] = verseLemmasArr;
      } else {
        // Merge lemmas when multiple morphhb verses map to the same Sefaria verse
        // (e.g., Ten Commandments where morphhb splits verses that Sefaria combines)
        if (verseLemmas[verseKey]) {
          verseLemmas[verseKey] = verseLemmas[verseKey].concat(lemmas);
        } else {
          verseLemmas[verseKey] = lemmas;
        }
      }
      totalVerses++;
    }
  }
}

// Convert wordLemmas Sets to arrays for JSON serialization
const wordLemmasArray: Record<string, string[]> = {};
for (const [word, lemmaSet] of Object.entries(wordLemmas)) {
  wordLemmasArray[word] = Array.from(lemmaSet);
}

console.log(`Processed ${totalVerses} verses with ${totalWords} words`);
console.log(`  Verse key alignment: ${remappedVerses} remapped to Sefaria numbering, ${unmatchedVerses} unmatched (using morphhb key)`);
console.log(`Found ${Object.keys(wordLemmasArray).length} unique Hebrew word forms`);
console.log(`Found ${Object.keys(strongsToRoot).length} unique Strong's numbers`);

// Write output files
const outputDir = path.join(__dirname, '..', 'public', 'data');

fs.writeFileSync(
  path.join(outputDir, 'verse-lemmas.json'),
  JSON.stringify(verseLemmas, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'word-lemmas.json'),
  JSON.stringify(wordLemmasArray, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'strongs-to-root.json'),
  JSON.stringify(strongsToRoot, null, 2)
);

console.log('Generated:');
console.log('  - public/data/verse-lemmas.json');
console.log('  - public/data/word-lemmas.json');
console.log('  - public/data/strongs-to-root.json');
