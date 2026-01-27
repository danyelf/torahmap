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

// New format from Wikipedia baseline data
interface WikipediaSourceEntry {
  book: string;
  chapters: string; // "15" (single chapter as string)
  verses: string; // "all", "1-11", "5"
  era: string;
  date_bce: number; // Single date estimate
  note: string;
  citation?: string;
}

// Legacy format (for future use)
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

type SourceData = WikipediaSourceEntry[] | { entries: SourceEntry[] };

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
 *   "6-end" -> [6,7,...,verseCount] (from verse 6 to end)
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

  // Range: "1-11" or "6-end"
  const [startStr, endStr] = range.split("-");
  const start = parseInt(startStr.trim(), 10);

  // Handle "end" keyword
  const end = endStr.trim() === "end" ? verseCount : parseInt(endStr.trim(), 10);

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

/**
 * Normalize Wikipedia format to standard SourceEntry format
 * Returns array to handle chapters: "all" expansion
 */
function normalizeWikipediaEntry(
  wiki: WikipediaSourceEntry,
  structure: TanakhStructure
): SourceEntry[] {
  // Convert "all" to "*" (wildcard)
  const verses = wiki.verses === "all" ? "*" : wiki.verses;

  // Convert single date to range (±25 years for uncertainty)
  const dateBce = Math.abs(wiki.date_bce);
  const uncertainty = 25;
  const min = -(dateBce + uncertainty);
  const max = -(dateBce - uncertainty);

  // Augment note with citation if present
  const note = wiki.citation
    ? `${wiki.note} [Source](${wiki.citation})`
    : wiki.note;

  // Get book structure for chapter expansions
  const book = structure.books.find((b) => b.name === wiki.book);
  if (!book) {
    throw new Error(`Book not found: ${wiki.book}`);
  }

  // Handle chapters: "all" by expanding to all chapters in the book
  if (wiki.chapters === "all") {
    return book.chapters.map((_, chapterIndex) => ({
      book: wiki.book,
      chapter: chapterIndex + 1,
      verses,
      dating: { min, max },
      note,
    }));
  }

  // Handle comma-separated chapter ranges: "1-14,16-40" or "1-4,6-21"
  if (wiki.chapters.includes(",")) {
    const ranges = wiki.chapters.split(",").map((r) => r.trim());
    const results: SourceEntry[] = [];

    for (const range of ranges) {
      if (range.includes("-")) {
        // Range like "1-14"
        const [startStr, endStr] = range.split("-");
        const startChapter = parseInt(startStr.trim(), 10);
        const endChapter = parseInt(endStr.trim(), 10);

        if (
          isNaN(startChapter) ||
          isNaN(endChapter) ||
          startChapter < 1 ||
          endChapter > book.chapters.length ||
          startChapter > endChapter
        ) {
          throw new Error(
            `Invalid chapter range: ${range} in ${wiki.chapters} for book ${wiki.book}`
          );
        }

        for (let ch = startChapter; ch <= endChapter; ch++) {
          results.push({
            book: wiki.book,
            chapter: ch,
            verses,
            dating: { min, max },
            note,
          });
        }
      } else {
        // Single chapter like "15"
        const chapter = parseInt(range, 10);
        if (isNaN(chapter) || chapter < 1 || chapter > book.chapters.length) {
          throw new Error(
            `Invalid chapter number: ${range} in ${wiki.chapters} for book ${wiki.book}`
          );
        }
        results.push({
          book: wiki.book,
          chapter,
          verses,
          dating: { min, max },
          note,
        });
      }
    }

    return results;
  }

  // Handle single chapter range: "2-9"
  if (wiki.chapters.includes("-")) {
    const [startStr, endStr] = wiki.chapters.split("-");
    const startChapter = parseInt(startStr.trim(), 10);
    const endChapter = parseInt(endStr.trim(), 10);

    if (
      isNaN(startChapter) ||
      isNaN(endChapter) ||
      startChapter < 1 ||
      endChapter > book.chapters.length ||
      startChapter > endChapter
    ) {
      throw new Error(
        `Invalid chapter range: ${wiki.chapters} for book ${wiki.book} (has ${book.chapters.length} chapters)`
      );
    }

    return Array.from(
      { length: endChapter - startChapter + 1 },
      (_, i) => ({
        book: wiki.book,
        chapter: startChapter + i,
        verses,
        dating: { min, max },
        note,
      })
    );
  }

  // Single chapter
  const chapter = parseInt(wiki.chapters, 10);
  if (isNaN(chapter)) {
    throw new Error(`Invalid chapter number: ${wiki.chapters} for book ${wiki.book}`);
  }

  return [
    {
      book: wiki.book,
      chapter,
      verses,
      dating: { min, max },
      note,
    },
  ];
}

/**
 * Normalize source data to array of SourceEntry
 */
function normalizeSourceData(
  data: SourceData,
  structure: TanakhStructure
): SourceEntry[] {
  if (Array.isArray(data)) {
    // Wikipedia format: array of WikipediaSourceEntry
    // Flatten because normalizeWikipediaEntry can return multiple entries
    return data.flatMap((wiki) => normalizeWikipediaEntry(wiki, structure));
  } else {
    // Legacy format: { entries: SourceEntry[] }
    return data.entries;
  }
}

async function main() {
  console.log("Generating text-dating data...\n");

  // Load tanakh structure first (needed for normalization)
  const structurePath = new URL(
    "../public/data/tanakh-structure.json",
    import.meta.url
  );
  console.log(`Reading structure: ${structurePath.pathname}`);
  const structureJson = await readFile(structurePath, "utf-8");
  const structure: TanakhStructure = JSON.parse(structureJson);

  // Load source data
  const sourcePath = new URL("../data/text-dating-source.json", import.meta.url);
  console.log(`Reading source: ${sourcePath.pathname}`);
  const sourceJson = await readFile(sourcePath, "utf-8");
  const rawSourceData: SourceData = JSON.parse(sourceJson);

  // Normalize source data to standard format
  const sourceEntries = normalizeSourceData(rawSourceData, structure);
  console.log(`Normalized to ${sourceEntries.length} chapter entries\n`);

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

  for (const entry of sourceEntries) {
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
      const existingVerse = books[entry.book][chapterIndex][verseIndex];

      // Only apply if verse has no date, or if new date is earlier
      // Use midpoint of date range for comparison
      if (existingVerse === null) {
        books[entry.book][chapterIndex][verseIndex] = verseDating;
        totalVerses++;
      } else {
        const existingMidpoint = (existingVerse.d[0] + existingVerse.d[1]) / 2;
        const newMidpoint = (entry.dating.min + entry.dating.max) / 2;

        // Earlier date wins (more negative = older BCE date)
        if (newMidpoint < existingMidpoint) {
          books[entry.book][chapterIndex][verseIndex] = verseDating;
        }
      }
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
