// Verse text loading from Sefaria export data

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

// Map from our book names to file prefixes
const BOOK_FILES: Record<string, string> = {
  // Torah
  'Genesis': 'genesis',
  'Exodus': 'exodus',
  'Leviticus': 'leviticus',
  'Numbers': 'numbers',
  'Deuteronomy': 'deuteronomy',
  // Prophets
  'Joshua': 'joshua',
  'Judges': 'judges',
  'I Samuel': 'i-samuel',
  'II Samuel': 'ii-samuel',
  'I Kings': 'i-kings',
  'II Kings': 'ii-kings',
  'Isaiah': 'isaiah',
  'Jeremiah': 'jeremiah',
  'Ezekiel': 'ezekiel',
  'Hosea': 'hosea',
  'Joel': 'joel',
  'Amos': 'amos',
  'Obadiah': 'obadiah',
  'Jonah': 'jonah',
  'Micah': 'micah',
  'Nahum': 'nahum',
  'Habakkuk': 'habakkuk',
  'Zephaniah': 'zephaniah',
  'Haggai': 'haggai',
  'Zechariah': 'zechariah',
  'Malachi': 'malachi',
  // Writings
  'Psalms': 'psalms',
  'Proverbs': 'proverbs',
  'Job': 'job',
  'Song of Songs': 'song-of-songs',
  'Ruth': 'ruth',
  'Lamentations': 'lamentations',
  'Ecclesiastes': 'ecclesiastes',
  'Esther': 'esther',
  'Daniel': 'daniel',
  'Ezra': 'ezra',
  'Nehemiah': 'nehemiah',
  'I Chronicles': 'i-chronicles',
  'II Chronicles': 'ii-chronicles',
};

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

  const heData: SefariaTextFile = await heResponse.json();
  const enData: SefariaTextFile = await enResponse.json();

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
