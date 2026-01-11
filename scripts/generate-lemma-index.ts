/**
 * Generate lemma index from morphhb for Hebrew search canonicalization
 *
 * Outputs:
 * 1. verse-lemmas.json: Map of verse key -> array of Strong's numbers
 * 2. word-lemmas.json: Map of Hebrew word (no nikkud) -> array of Strong's numbers
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

/**
 * Strip nikkud from Hebrew text
 */
function stripNikkud(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip nikkud marks but keep Hebrew letters and other characters
    if (code < 0x0591 || code > 0x05C7 || code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6) {
      result += char;
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

const verseLemmas: VerseLemmas = {};
const wordLemmas: WordLemmas = {};

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
          const rootWord = stripNikkud(parts[parts.length - 1]);

          // Also store each part that could be searched
          for (const part of parts) {
            const stripped = stripNikkud(part);
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

console.log('Generated:');
console.log('  - public/data/verse-lemmas.json');
console.log('  - public/data/word-lemmas.json');
