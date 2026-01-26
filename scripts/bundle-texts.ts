#!/usr/bin/env npx tsx
/**
 * Bundle all verse text JSON files into a single all-texts.json file.
 * This reduces 78 HTTP requests to 1 at runtime.
 *
 * Usage: npx tsx scripts/bundle-texts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SefariaTextFile {
  title: string;
  language: string;
  text: string[][];
}

interface VerseText {
  he: string;
  en: string;
}

type BookTexts = Record<string, Record<string, VerseText>>;
type AllTexts = Record<string, BookTexts>;

// Book definitions (same as src/constants/books.ts)
const BOOKS = [
  { name: 'Genesis', file: 'genesis' },
  { name: 'Exodus', file: 'exodus' },
  { name: 'Leviticus', file: 'leviticus' },
  { name: 'Numbers', file: 'numbers' },
  { name: 'Deuteronomy', file: 'deuteronomy' },
  { name: 'Joshua', file: 'joshua' },
  { name: 'Judges', file: 'judges' },
  { name: 'I Samuel', file: 'i-samuel' },
  { name: 'II Samuel', file: 'ii-samuel' },
  { name: 'I Kings', file: 'i-kings' },
  { name: 'II Kings', file: 'ii-kings' },
  { name: 'Isaiah', file: 'isaiah' },
  { name: 'Jeremiah', file: 'jeremiah' },
  { name: 'Ezekiel', file: 'ezekiel' },
  { name: 'Hosea', file: 'hosea' },
  { name: 'Joel', file: 'joel' },
  { name: 'Amos', file: 'amos' },
  { name: 'Obadiah', file: 'obadiah' },
  { name: 'Jonah', file: 'jonah' },
  { name: 'Micah', file: 'micah' },
  { name: 'Nahum', file: 'nahum' },
  { name: 'Habakkuk', file: 'habakkuk' },
  { name: 'Zephaniah', file: 'zephaniah' },
  { name: 'Haggai', file: 'haggai' },
  { name: 'Zechariah', file: 'zechariah' },
  { name: 'Malachi', file: 'malachi' },
  { name: 'Psalms', file: 'psalms' },
  { name: 'Proverbs', file: 'proverbs' },
  { name: 'Job', file: 'job' },
  { name: 'Song of Songs', file: 'song-of-songs' },
  { name: 'Ruth', file: 'ruth' },
  { name: 'Lamentations', file: 'lamentations' },
  { name: 'Ecclesiastes', file: 'ecclesiastes' },
  { name: 'Esther', file: 'esther' },
  { name: 'Daniel', file: 'daniel' },
  { name: 'Ezra', file: 'ezra' },
  { name: 'Nehemiah', file: 'nehemiah' },
  { name: 'I Chronicles', file: 'i-chronicles' },
  { name: 'II Chronicles', file: 'ii-chronicles' },
];

// Strip HTML tags and footnotes from text
function cleanText(text: string): string {
  return text
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '') // Remove footnote markers
    .replace(/<i>([^<]*)<\/i>/g, '$1') // Flatten nested <i> tags (keep content)
    .replace(/<i class="footnote">[\s\S]*?<\/i>/g, '') // Remove footnotes (now without nested tags)
    .replace(/<br\s*\/?>/gi, ' ') // Convert <br> to space (for poetry)
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with regular space
    .replace(/&[a-z]+;/g, ' ') // Replace other HTML entities with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function loadBook(dataDir: string, filePrefix: string): BookTexts {
  const hePath = path.join(dataDir, `${filePrefix}-he.json`);
  const enPath = path.join(dataDir, `${filePrefix}-en.json`);

  const heData: SefariaTextFile = JSON.parse(fs.readFileSync(hePath, 'utf-8'));
  const enData: SefariaTextFile = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

  const bookTexts: BookTexts = {};

  for (let chapterIdx = 0; chapterIdx < heData.text.length; chapterIdx++) {
    const chapterNum = String(chapterIdx + 1);
    bookTexts[chapterNum] = {};

    const heChapter = heData.text[chapterIdx] || [];
    const enChapter = enData.text[chapterIdx] || [];

    for (let verseIdx = 0; verseIdx < heChapter.length; verseIdx++) {
      const verseNum = String(verseIdx + 1);
      bookTexts[chapterNum][verseNum] = {
        he: cleanText(heChapter[verseIdx] || ''),
        en: cleanText(enChapter[verseIdx] || ''),
      };
    }
  }

  return bookTexts;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(projectRoot, 'data', 'texts');
  const outputPath = path.join(projectRoot, 'public', 'data', 'all-texts.json');

  console.log('Bundling verse texts...');
  console.log(`  Source: ${dataDir}`);
  console.log(`  Output: ${outputPath}`);

  const allTexts: AllTexts = {};
  let totalVerses = 0;

  for (const book of BOOKS) {
    process.stdout.write(`  Loading ${book.name}...`);
    const bookTexts = loadBook(dataDir, book.file);
    allTexts[book.name] = bookTexts;

    const verses = Object.values(bookTexts).reduce(
      (sum, ch) => sum + Object.keys(ch).length,
      0
    );
    totalVerses += verses;
    console.log(` ${verses} verses`);
  }

  console.log(`\nWriting bundled file...`);
  const json = JSON.stringify(allTexts);
  fs.writeFileSync(outputPath, json);

  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
  console.log(`Done! ${BOOKS.length} books, ${totalVerses} verses, ${sizeMB} MB`);
}

main();
