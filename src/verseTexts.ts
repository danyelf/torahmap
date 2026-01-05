// Verse text loading from Sefaria export data

import { BOOK_FILES } from './constants/books.ts';

export interface VerseText {
  he: string;
  en: string;
}

export type VerseTexts = Record<string, Record<string, Record<string, VerseText>>>;
// Structure: { [book]: { [chapter]: { [verse]: { he, en } } } }

interface SefariaTextFile {
  title: string;
  language: string;
  text: string[][];
}

// Strip HTML tags and footnotes from text
function cleanText(text: string): string {
  return text
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '') // Remove footnote markers
    .replace(/<i class="footnote">[\s\S]*?<\/i>/g, '') // Remove footnotes (with nested tags)
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with regular space
    .replace(/&[a-z]+;/g, '') // Remove other HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

async function loadBookTexts(
  filePrefix: string
): Promise<Record<string, Record<string, VerseText>>> {
  const [heResponse, enResponse] = await Promise.all([
    fetch(`/data/texts/${filePrefix}-he.json`),
    fetch(`/data/texts/${filePrefix}-en.json`),
  ]);

  if (!heResponse.ok || !enResponse.ok) {
    console.error(`Failed to load text files for ${filePrefix}: he=${heResponse.status}, en=${enResponse.status}`);
    return {};
  }

  let heData: SefariaTextFile;
  let enData: SefariaTextFile;
  try {
    heData = await heResponse.json();
    enData = await enResponse.json();
  } catch (e) {
    console.error(`Failed to parse text files for ${filePrefix}:`, e);
    return {};
  }

  const bookTexts: Record<string, Record<string, VerseText>> = {};

  // Both files should have same structure: text[chapter][verse]
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

export async function loadAllVerseTexts(): Promise<VerseTexts> {
  const verseTexts: VerseTexts = {};

  // Load all books in parallel
  const entries = Object.entries(BOOK_FILES);
  const results = await Promise.all(
    entries.map(([bookName, filePrefix]) =>
      loadBookTexts(filePrefix).then((texts) => ({ bookName, texts }))
    )
  );

  for (const { bookName, texts } of results) {
    verseTexts[bookName] = texts;
  }

  console.log(`Loaded verse texts for ${Object.keys(verseTexts).length} books`);
  return verseTexts;
}

export function getVerseText(
  verseTexts: VerseTexts,
  book: string,
  chapter: number,
  verse: number
): VerseText | null {
  return verseTexts[book]?.[String(chapter)]?.[String(verse)] || null;
}
