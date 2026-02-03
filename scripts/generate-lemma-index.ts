/**
 * Generate lemma index from morphhb for Hebrew search canonicalization
 *
 * Outputs:
 * 1. verse-lemmas.json: Map of verse key -> array of Strong's numbers
 * 2. word-lemmas.json: Map of Hebrew word (no nikkud) -> array of Strong's numbers
 * 3. strongs-to-root.json: Map of Strong's number -> canonical Hebrew root (no nikkud)
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
 * Extract Strong's number from morphhb encoding
 * Examples: "H1234" -> "1234", "Hc/H1234" -> "1234"
 */
function extractStrongsNumber(strongsField: string): string | null {
  const match = strongsField.match(/H(\d+)/);
  return match ? match[1] : null;
}

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

for (const bookName of Object.keys(morphhb)) {
  const ourBookName = BOOK_NAME_MAP[bookName];
  if (!ourBookName) {
    console.warn(`Warning: No mapping for book "${bookName}"`);
    continue;
  }

  const book = morphhb[bookName];

  for (let chapterIdx = 0; chapterIdx < book.length; chapterIdx++) {
    const chapter = book[chapterIdx];

    for (let verseIdx = 0; verseIdx < chapter.length; verseIdx++) {
      const verse = chapter[verseIdx];
      const verseKey = `${ourBookName}:${chapterIdx + 1}:${verseIdx + 1}`;
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

      verseLemmas[verseKey] = lemmas;
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
