/**
 * Generates text-dating.json from source data and tanakh structure
 *
 * Reads data/text-dating-source.json (range format) and expands chapter/verse
 * ranges (including wildcards) into per-verse entries for runtime lookup.
 *
 * Source format accepts ranges like "1-11" or "*" for all verses.
 * Output format uses note_id references to deduplicated notes for compact storage.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

interface SourceEntry {
  book: string;
  chapter: number;
  verses: string; // "1-11", "5", "*"
  dating: {
    min: number; // BCE year (negative) or CE year (positive)
    max: number;
  };
  note: string;
}

interface SourceData {
  entries: SourceEntry[];
}

interface TanakhStructure {
  books: Array<{
    name: string;
    hebrewName: string;
    chapters: number[]; // verse counts per chapter
  }>;
}

interface VerseDating {
  d: [number, number]; // [min, max] date range
  n: number; // note_id reference
}

interface RuntimeData {
  notes: string[];
  books: {
    [bookName: string]: VerseDating[][]; // [chapter][verse]
  };
}

/**
 * Parse verse range string into array of verse numbers
 * Examples:
 *   "5" -> [5]
 *   "1-11" -> [1,2,3,4,5,6,7,8,9,10,11]
 *   "*" -> [1,2,...,verseCount] (all verses)
 */
function parseVerseRange(range: string, verseCount: number): number[] {
  range = range.trim();

  // Wildcard: all verses
  if (range === "*") {
    return Array.from({ length: verseCount }, (_, i) => i + 1);
  }

  // Single verse
  if (!range.includes("-")) {
    const verse = parseInt(range, 10);
    if (isNaN(verse) || verse < 1 || verse > verseCount) {
      throw new Error(
        `Invalid verse number: ${range} (chapter has ${verseCount} verses)`
      );
    }
    return [verse];
  }

  // Range: "1-11"
  const [startStr, endStr] = range.split("-");
  const start = parseInt(startStr.trim(), 10);
  const end = parseInt(endStr.trim(), 10);

  if (
    isNaN(start) ||
    isNaN(end) ||
    start < 1 ||
    end > verseCount ||
    start > end
  ) {
    throw new Error(
      `Invalid verse range: ${range} (chapter has ${verseCount} verses)`
    );
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Get verse count for a specific chapter
 */
function getVerseCount(
  structure: TanakhStructure,
  bookName: string,
  chapterNum: number
): number {
  const book = structure.books.find((b) => b.name === bookName);
  if (!book) {
    throw new Error(`Book not found: ${bookName}`);
  }

  if (chapterNum < 1 || chapterNum > book.chapters.length) {
    throw new Error(
      `Invalid chapter ${chapterNum} for ${bookName} (has ${book.chapters.length} chapters)`
    );
  }

  return book.chapters[chapterNum - 1];
}

async function main() {
  console.log("Generating text-dating data...\n");

  // Load source data
  const sourcePath = new URL("../data/text-dating-source.json", import.meta.url);
  console.log(`Reading source: ${sourcePath.pathname}`);
  const sourceJson = await readFile(sourcePath, "utf-8");
  const sourceData: SourceData = JSON.parse(sourceJson);

  // Load tanakh structure
  const structurePath = new URL(
    "../public/data/tanakh-structure.json",
    import.meta.url
  );
  console.log(`Reading structure: ${structurePath.pathname}`);
  const structureJson = await readFile(structurePath, "utf-8");
  const structure: TanakhStructure = JSON.parse(structureJson);

  // Initialize output data
  const notes: string[] = [];
  const noteMap = new Map<string, number>(); // note -> note_id
  const books: { [bookName: string]: VerseDating[][] } = {};

  // Initialize book structure (all null initially)
  for (const book of structure.books) {
    books[book.name] = book.chapters.map((verseCount) =>
      Array.from({ length: verseCount }, () => null as VerseDating | null)
    );
  }

  // Process each source entry
  let totalEntries = 0;
  let totalVerses = 0;

  for (const entry of sourceData.entries) {
    totalEntries++;

    // Get or create note_id
    let noteId = noteMap.get(entry.note);
    if (noteId === undefined) {
      noteId = notes.length;
      notes.push(entry.note);
      noteMap.set(entry.note, noteId);
    }

    // Parse verse range
    const verseCount = getVerseCount(structure, entry.book, entry.chapter);
    const verses = parseVerseRange(entry.verses, verseCount);

    // Apply dating to each verse
    const verseDating: VerseDating = {
      d: [entry.dating.min, entry.dating.max],
      n: noteId,
    };

    const chapterIndex = entry.chapter - 1;
    for (const verseNum of verses) {
      const verseIndex = verseNum - 1;
      books[entry.book][chapterIndex][verseIndex] = verseDating;
      totalVerses++;
    }

    console.log(
      `  ${entry.book} ${entry.chapter}:${entry.verses} -> ${verses.length} verses (${entry.dating.min} to ${entry.dating.max})`
    );
  }

  // Remove null entries (verses without dating)
  // Convert to sparse format or keep full structure?
  // For now, keep full structure but remove books with no data
  const booksWithData: { [bookName: string]: VerseDating[][] } = {};
  for (const [bookName, chapters] of Object.entries(books)) {
    const hasData = chapters.some((chapter) =>
      chapter.some((verse) => verse !== null)
    );
    if (hasData) {
      booksWithData[bookName] = chapters;
    }
  }

  const result: RuntimeData = {
    notes,
    books: booksWithData,
  };

  // Ensure output directory exists
  const outputPath = new URL(
    "../public/data/text-dating.json",
    import.meta.url
  );
  const outputDir = dirname(outputPath.pathname);
  await mkdir(outputDir, { recursive: true });

  // Write output
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outputPath.pathname}`);

  // Summary
  console.log(`\nSummary:`);
  console.log(`  Source entries: ${totalEntries}`);
  console.log(`  Unique notes: ${notes.length}`);
  console.log(`  Verses with dating: ${totalVerses}`);
  console.log(`  Books with data: ${Object.keys(booksWithData).length}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
