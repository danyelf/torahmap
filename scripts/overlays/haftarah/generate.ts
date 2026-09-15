/**
 * Generates the Haftarah overlay's mappings from hebcal's leyning tables.
 *
 * Reads the two vendored JSON files under hebcal/ — see the README there
 * for where they came from and how to refresh them — and rewrites them into
 * the shape the Haftarah overlay expects: a Torah range and an Ashkenazi and
 * Sephardi haftarah for each of the 54 weekly portions, plus the haftarot read
 * on 29 special occasions.
 *
 * Every reference is checked against tanakh-structure.json before anything is
 * written, so a mangled range fails here rather than in the browser.
 *
 * Run with: npx tsx scripts/overlays/haftarah/generate.ts
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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
    | 'rosh-chodesh'
    | 'four-shabbatot'
    | 'high-holidays'
    | 'sukkot'
    | 'pesach'
    | 'shavuot'
    | 'fast-days'
    | 'other';
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

// The shape of the vendored hebcal files. `haft` is the Ashkenazi reading and
// `seph` the Sephardi one, present only where the two differ; either may be a
// single passage or a list of them.
interface HebcalPassage {
  k: string; // book name, e.g. "II Kings"
  b: string; // beginning, e.g. "42:5"
  e: string; // end, e.g. "43:10"
}

type HebcalReading = HebcalPassage | HebcalPassage[];

interface HebcalParsha {
  num: number | number[];
  book: number; // 1 = Genesis ... 5 = Deuteronomy
  haft?: HebcalReading;
  seph?: HebcalReading;
  fullkriyah: Record<string, [string, string, string?]>;
}

interface HebcalHoliday {
  haft?: HebcalReading;
  seph?: HebcalReading;
}

const TORAH_BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];

/**
 * What the map shows and what it calls each thing: the 54 weekly portions in
 * the order they are read, then the 29 occasions outside the weekly cycle that
 * have a haftarah of their own. Held in the overlay's names.json so that
 * editing a label does not mean editing this script.
 *
 * The portion names are Sefaria's, from the Parasha structure in its schema
 * export. The map links out to Sefaria, so a portion should be called here
 * what it is called there, down to the spelling. The occasion names are our
 * own: they label a legend rather than naming a division of any text, and no
 * source publishes a canonical list of them.
 *
 * `hebcal` is the key to look the reading up under in the leyning tables. Every
 * occasion needs one; a portion needs one only where hebcal spells it
 * differently, which is three of the 54.
 *
 * Where hebcal lists a separate entry for a festival day that happens to fall
 * on Shabbat, both entries name the same haftarah, so the plain key is the one
 * taken. The rows whose key is stranger than that carry a `note` saying why.
 */
interface ReadingName {
  name: string;
  hebrewName: string;
  hebcal?: string;
  category?: SpecialOccasion['category'];
  /** Why this row's hebcal key is not the obvious one. Read by people, not code. */
  note?: string;
}

const CATEGORIES: ReadonlyArray<SpecialOccasion['category']> = [
  'rosh-chodesh',
  'four-shabbatot',
  'high-holidays',
  'sukkot',
  'pesach',
  'shavuot',
  'fast-days',
  'other',
];

/**
 * Reads the names file, complaining about anything the generator would
 * otherwise turn into a silently wrong entry — a blank label, a category that
 * does not exist, an occasion with no hebcal key to look up.
 */
function checkNames(rows: ReadingName[], kind: 'portion' | 'occasion'): ReadingName[] {
  if (rows.length === 0) {
    throw new Error(`names.json lists no ${kind}s`);
  }

  rows.forEach((row, i) => {
    const where = `${kind} ${i + 1} (${row.name ?? 'unnamed'})`;
    if (!row.name?.trim()) throw new Error(`${where}: no name`);
    if (!row.hebrewName?.trim()) throw new Error(`${where}: no Hebrew name`);

    if (kind === 'occasion') {
      if (!row.hebcal?.trim()) throw new Error(`${where}: no hebcal key`);
      if (!row.category) throw new Error(`${where}: no category`);
      if (!CATEGORIES.includes(row.category)) {
        throw new Error(
          `${where}: category "${row.category}" is not one of ${CATEGORIES.join(', ')}`,
        );
      }
    }
  });

  const duplicated = rows.map((r) => r.name).filter((n, i, all) => all.indexOf(n) !== i);
  if (duplicated.length > 0) {
    throw new Error(`names.json names the same ${kind} twice: ${duplicated.join(', ')}`);
  }

  return rows;
}

/** Turns hebcal's "42:5" into a chapter and verse. */
function parseRef(ref: string, context: string): VerseRef {
  const match = ref.match(/^(\d+):(\d+)$/);
  if (!match) {
    throw new Error(`${context}: cannot read reference "${ref}"`);
  }
  return { chapter: parseInt(match[1], 10), verse: parseInt(match[2], 10) };
}

/** One hebcal passage as a range of ours. */
function toRange(passage: HebcalPassage, context: string): VerseRange {
  return {
    book: passage.k,
    start: parseRef(passage.b, `${context} start`),
    end: parseRef(passage.e, `${context} end`),
  };
}

/**
 * The two customs' readings for one portion or occasion. hebcal records the
 * Sephardi reading only where it differs from the Ashkenazi one, so an absent
 * `seph` means the two read the same passage.
 */
function readBothCustoms(
  entry: { haft?: HebcalReading; seph?: HebcalReading },
  context: string,
): { ashkenazi: VerseRange[]; sephardi: VerseRange[] } {
  const asList = (reading: HebcalReading | undefined): HebcalPassage[] =>
    reading === undefined ? [] : Array.isArray(reading) ? reading : [reading];

  const ashkenazi = asList(entry.haft).map((p, i) => toRange(p, `${context} Ashkenazi[${i}]`));
  const sephardi = entry.seph
    ? asList(entry.seph).map((p, i) => toRange(p, `${context} Sephardi[${i}]`))
    : ashkenazi.map((range) => structuredClone(range));

  return { ashkenazi, sephardi };
}

/**
 * The span of a portion in the Torah: from the opening of the first aliyah to
 * the close of the seventh. The maftir sits inside the seventh, so it adds
 * nothing to the span.
 */
function torahSpan(entry: HebcalParsha, context: string): VerseRange {
  const book = TORAH_BOOKS[entry.book - 1];
  if (!book) {
    throw new Error(`${context}: unknown Torah book number ${entry.book}`);
  }

  const first = entry.fullkriyah['1'];
  const last = entry.fullkriyah['7'];
  if (!first || !last) {
    throw new Error(`${context}: missing the first or seventh aliyah`);
  }

  return {
    book,
    start: parseRef(first[0], `${context} Torah start`),
    end: parseRef(last[1], `${context} Torah end`),
  };
}

interface TanakhStructure {
  books: Array<{
    name: string;
    hebrewName: string;
    chapters: number[];
  }>;
}

function validateVerseRange(range: VerseRange, structure: TanakhStructure, context: string): void {
  const bookData = structure.books.find((b) => b.name === range.book);
  if (!bookData) {
    throw new Error(`${context}: Unknown book "${range.book}"`);
  }

  for (const which of ['start', 'end'] as const) {
    const { chapter, verse } = range[which];
    if (chapter < 1 || chapter > bookData.chapters.length) {
      throw new Error(
        `${context}: ${range.book} ${which} chapter ${chapter} out of range (1-${bookData.chapters.length})`,
      );
    }
    const verseCount = bookData.chapters[chapter - 1];
    if (verse < 1 || verse > verseCount) {
      throw new Error(
        `${context}: ${range.book} ${chapter}:${verse} out of range (1-${verseCount})`,
      );
    }
  }

  if (
    range.start.chapter > range.end.chapter ||
    (range.start.chapter === range.end.chapter && range.start.verse > range.end.verse)
  ) {
    throw new Error(
      `${context}: ${range.book} ${range.start.chapter}:${range.start.verse} comes after ${range.end.chapter}:${range.end.verse}`,
    );
  }
}

function describe(ranges: VerseRange[]): string {
  return ranges
    .map((r) => `${r.book} ${r.start.chapter}:${r.start.verse}-${r.end.chapter}:${r.end.verse}`)
    .join('; ');
}

async function readJson<T>(relativePath: string): Promise<T> {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(await readFile(url, 'utf-8')) as T;
}

async function main() {
  console.log("Generating haftarah mappings from hebcal's leyning tables...\n");

  const aliyot = await readJson<Record<string, HebcalParsha>>(
    '../../../data/overlays/haftarah/hebcal/aliyot.json',
  );
  const holidays = await readJson<Record<string, HebcalHoliday>>(
    '../../../data/overlays/haftarah/hebcal/holiday-readings.json',
  );
  const structure = await readJson<TanakhStructure>('../../../public/data/tanakh-structure.json');
  const names = await readJson<{ parshiot: ReadingName[]; occasions: ReadingName[] }>(
    '../../../data/overlays/haftarah/names.json',
  );
  const parshaNames = checkNames(names.parshiot, 'portion');
  const occasionNames = checkNames(names.occasions, 'occasion');

  const errors: string[] = [];
  const check = (ranges: VerseRange[], context: string) => {
    ranges.forEach((range, i) => {
      try {
        validateVerseRange(range, structure, `${context}[${i}]`);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    });
  };

  console.log('=== PARSHIOT ===\n');

  const parshiot: Parsha[] = parshaNames.map(({ hebcal, name, hebrewName }) => {
    const key = hebcal ?? name;
    const entry = aliyot[key];
    if (!entry) {
      throw new Error(`hebcal has no portion named "${key}" (for ${name})`);
    }

    const torah = torahSpan(entry, name);
    const haftarah = readBothCustoms(entry, name);

    check([torah], `${name} Torah`);
    check(haftarah.ashkenazi, `${name} Ashkenazi`);
    check(haftarah.sephardi, `${name} Sephardi`);

    console.log(`${name} (${hebrewName})`);
    console.log(`  Torah: ${describe([torah])}`);
    console.log(`  Ashkenazi: ${describe(haftarah.ashkenazi)}`);
    if (JSON.stringify(haftarah.sephardi) !== JSON.stringify(haftarah.ashkenazi)) {
      console.log(`  Sephardi:  ${describe(haftarah.sephardi)}`);
    }

    return { name, hebrewName, torah, haftarah };
  });

  console.log('\n=== SPECIAL OCCASIONS ===\n');

  const specialOccasions: SpecialOccasion[] = occasionNames.map(
    ({ hebcal, name, hebrewName, category }) => {
      // checkNames has already refused an occasion missing either of these.
      const key = hebcal!;
      const entry = holidays[key];
      if (!entry) {
        throw new Error(`hebcal has no occasion named "${key}" (for ${name})`);
      }
      if (!entry.haft) {
        throw new Error(`hebcal records no haftarah for "${key}"`);
      }

      const haftarah = readBothCustoms(entry, name);

      check(haftarah.ashkenazi, `${name} Ashkenazi`);
      check(haftarah.sephardi, `${name} Sephardi`);

      console.log(`${name} (${hebrewName}) [${category}]`);
      console.log(`  Ashkenazi: ${describe(haftarah.ashkenazi)}`);
      if (JSON.stringify(haftarah.sephardi) !== JSON.stringify(haftarah.ashkenazi)) {
        console.log(`  Sephardi:  ${describe(haftarah.sephardi)}`);
      }

      return { name, hebrewName, category: category!, haftarah };
    },
  );

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} reference(s) did not check out:`);
    for (const message of errors) console.error(`   ${message}`);
    process.exit(1);
  }

  console.log('\n✅ Every reference checks out against tanakh-structure.json');

  const outputPath = new URL(
    '../../../public/data/overlays/haftarah/mappings.json',
    import.meta.url,
  );
  await mkdir(dirname(outputPath.pathname), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ parshiot, specialOccasions }, null, 2));

  console.log(`\nWrote ${outputPath.pathname}`);
  console.log(`  ${parshiot.length} weekly portions`);
  console.log(`  ${specialOccasions.length} special occasions`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
