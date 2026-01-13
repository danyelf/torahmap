/**
 * Generates haftarah-mappings.json by parsing mechon-mamre.org readings page.
 *
 * Parses the cached HTML from data/readings.html to extract all 54 Torah portions
 * and their haftarot. Supports both Ashkenazi and Sephardi customs.
 *
 * Data source: https://mechon-mamre.org/jewfaq/readings.htm
 * Cached locally for offline generation and version control.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

interface VerseRef {
  chapter: number;
  verse: number;
}

interface VerseRange {
  book: string;
  start: VerseRef;
  end: VerseRef;
}

interface Parsha {
  name: string;
  hebrewName: string;
  torah: VerseRange;
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

interface SpecialOccasion {
  name: string;
  hebrewName: string;
  category:
    | "rosh-chodesh"
    | "four-shabbatot"
    | "high-holidays"
    | "sukkot"
    | "pesach"
    | "shavuot"
    | "fast-days"
    | "other";
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

// Hebrew names for parshiot (mapping from mechon-mamre English transliteration)
const HEBREW_NAMES: Record<string, string> = {
  // Genesis
  Bereishit: "בראשית",
  Noach: "נח",
  "Lekh Lekha": "לך־לך",
  Vayeira: "וירא",
  "Chayei Sarah": "חיי שרה",
  Toldot: "תולדות",
  Vayeitzei: "ויצא",
  Vayishlach: "וישלח",
  Vayyeshev: "וישב",
  Miqeitz: "מקץ",
  Vayigash: "ויגש",
  Vayechi: "ויחי",
  // Exodus
  Shemot: "שמות",
  "Va'eira": "וארא",
  Bo: "בא",
  Beshalach: "בשלח",
  Yitro: "יתרו",
  Mishpatim: "משפטים",
  Terumah: "תרומה",
  Tetzaveh: "תצוה",
  "Ki Tisa": "כי תשא",
  Vayaqhel: "ויקהל",
  Pequdei: "פקודי",
  // Leviticus
  Vayiqra: "ויקרא",
  Tzav: "צו",
  Shemini: "שמיני",
  Tazria: "תזריע",
  Metzora: "מצורע",
  Acharei: "אחרי מות",
  Qedoshim: "קדושים",
  Emor: "אמור",
  Behar: "בהר",
  Bechuqotai: "בחוקותי",
  // Numbers
  Bamidbar: "במדבר",
  Nasso: "נשא",
  "Beha'alotkha": "בהעלותך",
  Shelach: "שלח",
  Qorach: "קורח",
  Chuqat: "חוקת",
  Balaq: "בלק",
  Pinchas: "פינחס",
  Mattot: "מטות",
  Masei: "מסעי",
  // Deuteronomy
  Devarim: "דברים",
  "Va'etchanan": "ואתחנן",
  Eiqev: "עקב",
  "Re'eh": "ראה",
  Shoftim: "שופטים",
  "Ki Teitzei": "כי תצא",
  "Ki Tavo": "כי תבוא",
  Nitzavim: "נצבים",
  Vayeilekh: "וילך",
  "Ha'azinu": "האזינו",
  "Vezot Haberakhah": "וזאת הברכה",
};

// Hebrew names for special occasions
const SPECIAL_HEBREW_NAMES: Record<string, string> = {
  "Rosh Hashanah, Day 1": "ראש השנה יום א׳",
  "Rosh Hashanah, Day 2": "ראש השנה יום ב׳",
  "Shabbat Shuvah": "שבת שובה",
  "Yom Kippur, Morning": "יום כיפור שחרית",
  "Yom Kippur, Afternoon": "יום כיפור מנחה",
  "Sukkot, Day 1": "סוכות יום א׳",
  "Sukkot, Day 2": "סוכות יום ב׳",
  "Sukkot, Intermediate Sabbath": "שבת חול המועד סוכות",
  "Shemini Atzeret": "שמיני עצרת",
  "Simchat Torah": "שמחת תורה",
  "Chanukkah, First Sabbath": "שבת חנוכה א׳",
  "Chanukkah, Second Sabbath": "שבת חנוכה ב׳",
  Sheqalim: "שבת שקלים",
  Zakhor: "שבת זכור",
  Purim: "פורים",
  Parah: "שבת פרה",
  "Ha-Chodesh": "שבת החודש",
  "Shabbat Ha-Gadol": "שבת הגדול",
  "Passover, Day 1": "פסח יום א׳",
  "Passover, Day 2": "פסח יום ב׳",
  "Passover, Intermediate Sabbath": "שבת חול המועד פסח",
  "Passover, Day 7": "פסח יום ז׳",
  "Passover, Day 8": "פסח יום ח׳",
  "Shavu'ot, Day 1": "שבועות יום א׳",
  "Shavu'ot, Day 2": "שבועות יום ב׳",
  "Tisha B'Av, Morning": "תשעה באב שחרית",
  "Tisha B'Av, Afternoon": "תשעה באב מנחה",
  "Minor Fasts, Morning": "צום קל שחרית",
  "Minor Fasts, Afternoon": "צום קל מנחה",
  "Rosh Chodesh (weekday)": "ראש חודש",
  "Shabbat on Eve of Rosh Chodesh": "שבת מחר חודש",
  "Shabbat Rosh Chodesh": "שבת ראש חודש",
};

// Category mapping for special occasions
const SPECIAL_CATEGORIES: Record<
  string,
  SpecialOccasion["category"]
> = {
  "Rosh Hashanah, Day 1": "high-holidays",
  "Rosh Hashanah, Day 2": "high-holidays",
  "Shabbat Shuvah": "high-holidays",
  "Yom Kippur, Morning": "high-holidays",
  "Yom Kippur, Afternoon": "high-holidays",
  "Sukkot, Day 1": "sukkot",
  "Sukkot, Day 2": "sukkot",
  "Sukkot, Intermediate Sabbath": "sukkot",
  "Shemini Atzeret": "sukkot",
  "Simchat Torah": "sukkot",
  "Chanukkah, First Sabbath": "other",
  "Chanukkah, Second Sabbath": "other",
  Sheqalim: "four-shabbatot",
  Zakhor: "four-shabbatot",
  Purim: "other",
  Parah: "four-shabbatot",
  "Ha-Chodesh": "four-shabbatot",
  "Shabbat Ha-Gadol": "other",
  "Passover, Day 1": "pesach",
  "Passover, Day 2": "pesach",
  "Passover, Intermediate Sabbath": "pesach",
  "Passover, Day 7": "pesach",
  "Passover, Day 8": "pesach",
  "Shavu'ot, Day 1": "shavuot",
  "Shavu'ot, Day 2": "shavuot",
  "Tisha B'Av, Morning": "fast-days",
  "Tisha B'Av, Afternoon": "fast-days",
  "Minor Fasts, Morning": "fast-days",
  "Minor Fasts, Afternoon": "fast-days",
  "Rosh Chodesh (weekday)": "rosh-chodesh",
  "Shabbat on Eve of Rosh Chodesh": "rosh-chodesh",
  "Shabbat Rosh Chodesh": "rosh-chodesh",
};

// Normalize book names from mechon-mamre format to our format
function normalizeBookName(name: string): string {
  // Replace non-breaking space with regular space and normalize
  name = name.replace(/\u00A0/g, " ").trim();

  // Map numeric prefixes to Roman numerals
  const bookMappings: Record<string, string> = {
    "1 Kings": "I Kings",
    "2 Kings": "II Kings",
    "1 Samuel": "I Samuel",
    "2 Samuel": "II Samuel",
    "1 Chronicles": "I Chronicles",
    "2 Chronicles": "II Chronicles",
  };

  return bookMappings[name] || name;
}

// Parse a verse reference like "42,5-43,10" or "42,5-21" into start/end
function parseVerseRef(
  book: string,
  refStr: string
): VerseRange {
  // Format: "startCh,startV-endCh,endV" or "startCh,startV-endV" (same chapter)
  const match = refStr.match(/(\d+),(\d+)-(\d+)(?:,(\d+))?/);
  if (!match) {
    throw new Error(`Cannot parse verse reference: ${book} ${refStr}`);
  }

  const startCh = parseInt(match[1], 10);
  const startV = parseInt(match[2], 10);
  let endCh: number;
  let endV: number;

  if (match[4]) {
    // Full format: "42,5-43,10"
    endCh = parseInt(match[3], 10);
    endV = parseInt(match[4], 10);
  } else {
    // Same chapter: "42,5-21"
    endCh = startCh;
    endV = parseInt(match[3], 10);
  }

  return {
    book: normalizeBookName(book),
    start: { chapter: startCh, verse: startV },
    end: { chapter: endCh, verse: endV },
  };
}

// Parse haftarah references from HTML cell content
// Handles multiple segments separated by semicolons and Sephardic variants in parentheses
function parseHaftarahCell(cellHtml: string): {
  ashkenazi: VerseRange[];
  sephardi: VerseRange[];
} {
  // Remove HTML tags but preserve structure
  // Split by <BR> to separate Ashkenazi from Sephardic

  // First, check if there's a parenthetical Sephardic variant
  const brParts = cellHtml.split(/<BR\s*\/?>/i);
  const ashkenaziHtml = brParts[0];
  const sephardiHtml = brParts.length > 1 ? brParts[1] : null;

  // Parse Ashkenazi references
  const ashkenazi = parseHaftarahReferences(ashkenaziHtml);

  // Parse Sephardi - either from parenthetical or same as Ashkenazi
  let sephardi: VerseRange[];
  if (sephardiHtml && sephardiHtml.includes("(")) {
    // Extract content from parentheses
    const parenMatch = sephardiHtml.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const parenContent = parenMatch[1].trim();
      // Handle "(none)" case - Sephardic don't read a haftarah
      if (parenContent.toLowerCase() === "none") {
        sephardi = [...ashkenazi]; // Fall back to Ashkenazi
      } else {
        sephardi = parseHaftarahReferences(parenMatch[1]);
        // If no valid references parsed, fall back to Ashkenazi
        if (sephardi.length === 0) {
          sephardi = [...ashkenazi];
        }
      }
    } else {
      sephardi = [...ashkenazi];
    }
  } else {
    sephardi = [...ashkenazi];
  }

  return { ashkenazi, sephardi };
}

// Parse a string of haftarah references (may have multiple segments with semicolons)
function parseHaftarahReferences(html: string): VerseRange[] {
  const results: VerseRange[] = [];

  // Extract all anchor tags and their text content
  // Pattern: <A HREF="...">Book Chapter,Verse-Chapter,Verse</A>
  // Or continuation: ; <A HREF="...">Chapter,Verse-Verse</A>

  // Remove parentheses (Sephardic marker)
  html = html.replace(/[()]/g, "");

  // Split by semicolon to get segments
  const segments = html.split(/;\s*/);

  let lastBook = "";

  for (const segment of segments) {
    // Extract the anchor content
    const anchorMatch = segment.match(
      /<A[^>]*>([^<]+)<\/A>/i
    );
    if (!anchorMatch) continue;

    const text = anchorMatch[1].trim();

    // Check if this segment has a book name or just verse references
    // Book names may start with a digit (e.g., "2 Kings") or letter
    // Replace non-breaking space with regular space for matching
    const normalizedText = text.replace(/\u00A0/g, " ");
    const bookMatch = normalizedText.match(
      /^([12]?\s*[A-Za-z][A-Za-z\s]*?)\s+(\d+,\d+-\d+(?:,\d+)?)/
    );

    if (bookMatch) {
      // Full reference with book name
      lastBook = bookMatch[1];
      results.push(parseVerseRef(lastBook, bookMatch[2]));
    } else {
      // Continuation reference without book name
      const verseMatch = text.match(/(\d+,\d+-\d+(?:,\d+)?)/);
      if (verseMatch && lastBook) {
        results.push(parseVerseRef(lastBook, verseMatch[1]));
      }
    }
  }

  return results;
}

// Parse Torah reference from HTML cell
function parseTorahRef(cellHtml: string): VerseRange | null {
  // Extract first anchor with Torah reference
  const anchorMatch = cellHtml.match(
    /<A[^>]*>([^<]+)<\/A>/i
  );
  if (!anchorMatch) return null;

  const text = anchorMatch[1].trim();
  const bookMatch = text.match(
    /^([A-Za-z]+)\s+(\d+,\d+-\d+(?:,\d+)?)/
  );

  if (!bookMatch) return null;

  return parseVerseRef(bookMatch[1], bookMatch[2]);
}

// Extract rows from HTML table
function extractTableRows(
  tableHtml: string
): Array<{ cells: string[] }> {
  const rows: Array<{ cells: string[] }> = [];

  // Split by <TR to get individual row segments
  const rowSegments = tableHtml.split(/<TR[^>]*>/i);

  for (const segment of rowSegments) {
    // Skip header rows (TH)
    if (/<TH/i.test(segment)) continue;

    // Extract TD cells - handle both self-closing </TD> and standard format
    const cells: string[] = [];
    const tdRegex = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
    let tdMatch;

    // Reset lastIndex since we're reusing the regex
    tdRegex.lastIndex = 0;

    while ((tdMatch = tdRegex.exec(segment)) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length >= 3) {
      rows.push({ cells });
    }
  }

  return rows;
}

// Extract parsha name from HTML cell
function extractParshaName(cellHtml: string): string {
  // For special occasions, the cell may have format like:
  // <A HREF="...">Rosh Hashanah</A>, Day 1
  // So we strip all HTML tags and get the full text
  const fullText = cellHtml.replace(/<[^>]+>/g, "").trim();

  // If it's a name with suffix (like ", Day 1"), return full text
  if (fullText.includes(",")) {
    return fullText;
  }

  // For regular parshiot, try to extract from anchor NAME attribute first
  const anchorMatch = cellHtml.match(
    /<A[^>]*NAME="([^"]+)"[^>]*>([^<]*)<\/A>/i
  );
  if (anchorMatch) {
    return anchorMatch[2].trim() || anchorMatch[1].trim();
  }

  return fullText;
}

// Load Tanakh structure for validation
interface TanakhStructure {
  books: Array<{
    name: string;
    hebrewName: string;
    chapters: number[];
  }>;
}

async function loadTanakhStructure(): Promise<TanakhStructure> {
  const structurePath = new URL(
    "../public/data/tanakh-structure.json",
    import.meta.url
  );
  const content = await readFile(structurePath, "utf-8");
  return JSON.parse(content);
}

function validateVerseRange(
  range: VerseRange,
  structure: TanakhStructure,
  context: string
): void {
  const bookData = structure.books.find((b) => b.name === range.book);
  if (!bookData) {
    throw new Error(`${context}: Unknown book "${range.book}"`);
  }

  if (range.start.verse === undefined || range.start.verse === null) {
    throw new Error(`${context}: ${range.book} start verse is undefined/null`);
  }
  if (range.end.verse === undefined || range.end.verse === null) {
    throw new Error(`${context}: ${range.book} end verse is undefined/null`);
  }

  if (
    range.start.chapter < 1 ||
    range.start.chapter > bookData.chapters.length
  ) {
    throw new Error(
      `${context}: ${range.book} start chapter ${range.start.chapter} out of range (1-${bookData.chapters.length})`
    );
  }
  if (range.end.chapter < 1 || range.end.chapter > bookData.chapters.length) {
    throw new Error(
      `${context}: ${range.book} end chapter ${range.end.chapter} out of range (1-${bookData.chapters.length})`
    );
  }

  const startChapterVerseCount = bookData.chapters[range.start.chapter - 1];
  if (range.start.verse < 1 || range.start.verse > startChapterVerseCount) {
    throw new Error(
      `${context}: ${range.book} ${range.start.chapter}:${range.start.verse} out of range (1-${startChapterVerseCount})`
    );
  }

  const endChapterVerseCount = bookData.chapters[range.end.chapter - 1];
  if (range.end.verse < 1 || range.end.verse > endChapterVerseCount) {
    throw new Error(
      `${context}: ${range.book} ${range.end.chapter}:${range.end.verse} out of range (1-${endChapterVerseCount})`
    );
  }

  if (range.start.chapter > range.end.chapter) {
    throw new Error(
      `${context}: ${range.book} start chapter ${range.start.chapter} > end chapter ${range.end.chapter}`
    );
  }
  if (
    range.start.chapter === range.end.chapter &&
    range.start.verse > range.end.verse
  ) {
    throw new Error(
      `${context}: ${range.book} ${range.start.chapter}:${range.start.verse} > ${range.end.chapter}:${range.end.verse}`
    );
  }
}

async function main() {
  console.log("Generating haftarah mappings from mechon-mamre HTML...\n");

  // Load HTML
  const htmlPath = new URL("../data/readings.html", import.meta.url);
  const html = await readFile(htmlPath, "utf-8");

  // Load structure for validation
  const structure = await loadTanakhStructure();

  // Find the two tables
  const tableRegex = /<TABLE[^>]*border="1"[^>]*>([\s\S]*?)<\/TABLE>/gi;
  const tables: string[] = [];
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tables.push(tableMatch[1]);
  }

  if (tables.length < 2) {
    throw new Error(
      `Expected 2 tables with border="1", found ${tables.length}`
    );
  }

  const weeklyTable = tables[0];
  const specialTable = tables[1];

  // Parse weekly parshiot
  const parshiot: Parsha[] = [];
  const weeklyRows = extractTableRows(weeklyTable);
  let errors = 0;

  console.log("=== PARSHIOT ===\n");

  for (const row of weeklyRows) {
    const name = extractParshaName(row.cells[0]);
    const torahHtml = row.cells[1];
    const haftarahHtml = row.cells[2];

    const torah = parseTorahRef(torahHtml);
    if (!torah) {
      console.error(`Skipping ${name}: no Torah reference`);
      continue;
    }

    const hebrewName = HEBREW_NAMES[name];
    if (!hebrewName) {
      console.error(`Warning: No Hebrew name for "${name}"`);
    }

    const haftarah = parseHaftarahCell(haftarahHtml);

    const parsha: Parsha = {
      name,
      hebrewName: hebrewName || name,
      torah,
      haftarah,
    };

    // Validate
    console.log(`${name} (${parsha.hebrewName})`);
    console.log(
      `  Torah: ${torah.book} ${torah.start.chapter}:${torah.start.verse}-${torah.end.chapter}:${torah.end.verse}`
    );

    try {
      validateVerseRange(torah, structure, `${name} Torah`);
    } catch (err) {
      console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    for (let i = 0; i < haftarah.ashkenazi.length; i++) {
      const range = haftarah.ashkenazi[i];
      try {
        validateVerseRange(range, structure, `${name} Ashkenazi[${i}]`);
      } catch (err) {
        console.error(
          `  ❌ ${err instanceof Error ? err.message : String(err)}`
        );
        errors++;
      }
    }

    for (let i = 0; i < haftarah.sephardi.length; i++) {
      const range = haftarah.sephardi[i];
      try {
        validateVerseRange(range, structure, `${name} Sephardi[${i}]`);
      } catch (err) {
        console.error(
          `  ❌ ${err instanceof Error ? err.message : String(err)}`
        );
        errors++;
      }
    }

    const ashkBooks = haftarah.ashkenazi.map((r) => r.book).join(", ");
    console.log(`  Haftarah (Ashk): ${ashkBooks}`);

    if (
      JSON.stringify(haftarah.ashkenazi) !== JSON.stringify(haftarah.sephardi)
    ) {
      const sephBooks = haftarah.sephardi.map((r) => r.book).join(", ");
      console.log(`  Haftarah (Seph): ${sephBooks}`);
    }

    parshiot.push(parsha);
  }

  // Parse special occasions
  const specialOccasions: SpecialOccasion[] = [];
  const specialRows = extractTableRows(specialTable);

  console.log("\n=== SPECIAL OCCASIONS ===\n");

  for (const row of specialRows) {
    const name = extractParshaName(row.cells[0]);
    const haftarahHtml = row.cells[2];

    // Skip rows without haftarah (empty cell or just whitespace/nbsp)
    if (!haftarahHtml || haftarahHtml.replace(/[\s\u00A0]/g, "") === "") {
      console.log(`${name}: No haftarah, skipping`);
      continue;
    }

    // Check if haftarah is actually empty (just nbsp or similar)
    if (!/<A/i.test(haftarahHtml)) {
      console.log(`${name}: No haftarah links, skipping`);
      continue;
    }

    const hebrewName = SPECIAL_HEBREW_NAMES[name];
    const category = SPECIAL_CATEGORIES[name];

    if (!hebrewName) {
      console.error(`Warning: No Hebrew name for special occasion "${name}"`);
    }
    if (!category) {
      console.error(`Warning: No category for special occasion "${name}"`);
    }

    const haftarah = parseHaftarahCell(haftarahHtml);

    // Skip if no valid haftarah parsed
    if (haftarah.ashkenazi.length === 0) {
      console.log(`${name}: No haftarah parsed, skipping`);
      continue;
    }

    const occasion: SpecialOccasion = {
      name,
      hebrewName: hebrewName || name,
      category: category || "other",
      haftarah,
    };

    console.log(`${name} (${occasion.hebrewName}) [${occasion.category}]`);

    for (let i = 0; i < haftarah.ashkenazi.length; i++) {
      const range = haftarah.ashkenazi[i];
      try {
        validateVerseRange(range, structure, `${name} Ashkenazi[${i}]`);
      } catch (err) {
        console.error(
          `  ❌ ${err instanceof Error ? err.message : String(err)}`
        );
        errors++;
      }
    }

    for (let i = 0; i < haftarah.sephardi.length; i++) {
      const range = haftarah.sephardi[i];
      try {
        validateVerseRange(range, structure, `${name} Sephardi[${i}]`);
      } catch (err) {
        console.error(
          `  ❌ ${err instanceof Error ? err.message : String(err)}`
        );
        errors++;
      }
    }

    const ashkBooks = haftarah.ashkenazi.map((r) => r.book).join(", ");
    console.log(`  Haftarah (Ashk): ${ashkBooks}`);

    if (
      JSON.stringify(haftarah.ashkenazi) !== JSON.stringify(haftarah.sephardi)
    ) {
      const sephBooks = haftarah.sephardi.map((r) => r.book).join(", ");
      console.log(`  Haftarah (Seph): ${sephBooks}`);
    }

    specialOccasions.push(occasion);
  }

  if (errors > 0) {
    console.error(`\n❌ Validation failed with ${errors} error(s)`);
    process.exit(1);
  }

  console.log("\n✅ All ranges validated successfully");

  // Ensure output directory exists
  const outputPath = new URL(
    "../public/data/haftarah-mappings.json",
    import.meta.url
  );
  const outputDir = dirname(outputPath.pathname);
  await mkdir(outputDir, { recursive: true });

  // Write output
  const output = { parshiot, specialOccasions };
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outputPath.pathname}`);

  // Summary
  console.log(`\nTotal parshiot: ${parshiot.length}`);
  console.log(`Total special occasions: ${specialOccasions.length}`);
  console.log(
    `Total items (parshiot + special occasions): ${parshiot.length + specialOccasions.length}`
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
