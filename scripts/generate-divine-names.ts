/**
 * Generates divine-names.json from Sefaria Torah text
 *
 * Downloads the 5 Torah books from Sefaria's GitHub export and counts
 * occurrences of divine names (YHWH and Elohim) in each verse.
 *
 * Output encoding per verse:
 *   0 = neither name present
 *   1 = YHWH only
 *   2 = Elohim only
 *   3 = both names present
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Sefaria GitHub raw URLs for Hebrew Torah texts
const SEFARIA_BASE =
  "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/json/Tanakh/Torah";

const BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
] as const;

// Divine name patterns
// YHWH (Tetragrammaton): יהוה
const YHWH_PATTERN = /יהוה/;

// Elohim: אלהים (includes forms like אלהי which is construct state)
// We match the base form אלהים
const ELOHIM_PATTERN = /אלהים/;

interface SefariaBook {
  text: string[][];
  title: string;
}

type DivineNamesData = {
  [book: string]: number[][];
};

async function fetchBook(bookName: string): Promise<SefariaBook> {
  // URL encode the filename - spaces become %20
  const url = `${SEFARIA_BASE}/${bookName}/Hebrew/Tanach%20with%20Text%20Only.json`;
  console.log(`Fetching ${bookName}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${bookName}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function encodeVerse(text: string): number {
  const hasYHWH = YHWH_PATTERN.test(text);
  const hasElohim = ELOHIM_PATTERN.test(text);

  if (hasYHWH && hasElohim) return 3;
  if (hasElohim) return 2;
  if (hasYHWH) return 1;
  return 0;
}

function processBook(book: SefariaBook): number[][] {
  return book.text.map((chapter) =>
    chapter.map((verse) => encodeVerse(verse))
  );
}

async function main() {
  console.log("Generating divine names data...\n");

  const result: DivineNamesData = {};

  // Fetch and process each book
  for (const bookName of BOOKS) {
    const book = await fetchBook(bookName);
    result[bookName] = processBook(book);

    // Log some stats
    const totalVerses = book.text.reduce((sum, ch) => sum + ch.length, 0);
    const totalChapters = book.text.length;

    // Count occurrences
    let yhwhOnly = 0;
    let elohimOnly = 0;
    let both = 0;
    let neither = 0;

    for (const chapter of result[bookName]) {
      for (const code of chapter) {
        if (code === 0) neither++;
        else if (code === 1) yhwhOnly++;
        else if (code === 2) elohimOnly++;
        else if (code === 3) both++;
      }
    }

    console.log(
      `  ${bookName}: ${totalChapters} chapters, ${totalVerses} verses`
    );
    console.log(
      `    YHWH only: ${yhwhOnly}, Elohim only: ${elohimOnly}, Both: ${both}, Neither: ${neither}`
    );
  }

  // Ensure output directory exists
  const outputPath = new URL(
    "../public/data/divine-names.json",
    import.meta.url
  );
  const outputDir = dirname(outputPath.pathname);
  await mkdir(outputDir, { recursive: true });

  // Write output
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outputPath.pathname}`);

  // Summary
  const totalVerses = Object.values(result).reduce(
    (sum, book) => sum + book.reduce((s, ch) => s + ch.length, 0),
    0
  );
  console.log(`\nTotal verses processed: ${totalVerses}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
