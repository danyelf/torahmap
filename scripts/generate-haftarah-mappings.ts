/**
 * Generates haftarah-mappings.json from hebcal's leyning tables.
 *
 * Reads the two vendored JSON files under data/hebcal/ — see the README there
 * for where they came from and how to refresh them — and rewrites them into
 * the shape the Haftarah overlay expects: a Torah range and an Ashkenazi and
 * Sephardi haftarah for each of the 54 weekly portions, plus the haftarot read
 * on 29 special occasions.
 *
 * Every reference is checked against tanakh-structure.json before anything is
 * written, so a mangled range fails here rather than in the browser.
 *
 * Run with: npx tsx scripts/generate-haftarah-mappings.ts
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
 * The 54 weekly portions, in the order they are read.
 *
 * The names are Sefaria's, taken from the Parasha structure inside its schema
 * export (storage.googleapis.com/sefaria-export/schemas/Genesis.json and the
 * other four books). The map links out to Sefaria, so a portion should be
 * called here what it is called there, down to the spelling.
 *
 * `hebcal` is the key to look the portion up under in the leyning tables,
 * needed only for the three where hebcal spells it differently.
 */
const PARSHIOT: Array<{ hebcal?: string; name: string; hebrewName: string }> = [
  // Genesis
  { name: 'Bereshit', hebrewName: 'בראשית' },
  { name: 'Noach', hebrewName: 'נח' },
  { hebcal: 'Lech-Lecha', name: 'Lech Lecha', hebrewName: 'לך לך' },
  { name: 'Vayera', hebrewName: 'וירא' },
  { name: 'Chayei Sara', hebrewName: 'חיי שרה' },
  { name: 'Toldot', hebrewName: 'תולדות' },
  { name: 'Vayetzei', hebrewName: 'ויצא' },
  { name: 'Vayishlach', hebrewName: 'וישלח' },
  { name: 'Vayeshev', hebrewName: 'וישב' },
  { name: 'Miketz', hebrewName: 'מקץ' },
  { name: 'Vayigash', hebrewName: 'ויגש' },
  { name: 'Vayechi', hebrewName: 'ויחי' },
  // Exodus
  { name: 'Shemot', hebrewName: 'שמות' },
  { name: 'Vaera', hebrewName: 'וארא' },
  { name: 'Bo', hebrewName: 'בא' },
  { name: 'Beshalach', hebrewName: 'בשלח' },
  { name: 'Yitro', hebrewName: 'יתרו' },
  { name: 'Mishpatim', hebrewName: 'משפטים' },
  { name: 'Terumah', hebrewName: 'תרומה' },
  { name: 'Tetzaveh', hebrewName: 'תצוה' },
  { name: 'Ki Tisa', hebrewName: 'כי תשא' },
  { name: 'Vayakhel', hebrewName: 'ויקהל' },
  { name: 'Pekudei', hebrewName: 'פקודי' },
  // Leviticus
  { name: 'Vayikra', hebrewName: 'ויקרא' },
  { name: 'Tzav', hebrewName: 'צו' },
  { name: 'Shmini', hebrewName: 'שמיני' },
  { name: 'Tazria', hebrewName: 'תזריע' },
  { name: 'Metzora', hebrewName: 'מצורע' },
  { name: 'Achrei Mot', hebrewName: 'אחרי מות' },
  { name: 'Kedoshim', hebrewName: 'קדושים' },
  { name: 'Emor', hebrewName: 'אמור' },
  { name: 'Behar', hebrewName: 'בהר' },
  { name: 'Bechukotai', hebrewName: 'בחוקתי' },
  // Numbers
  { name: 'Bamidbar', hebrewName: 'במדבר' },
  { name: 'Nasso', hebrewName: 'נשא' },
  { name: "Beha'alotcha", hebrewName: 'בהעלותך' },
  { name: "Sh'lach", hebrewName: 'שלח' },
  { name: 'Korach', hebrewName: 'קרח' },
  { name: 'Chukat', hebrewName: 'חקת' },
  { name: 'Balak', hebrewName: 'בלק' },
  { name: 'Pinchas', hebrewName: 'פנחס' },
  { name: 'Matot', hebrewName: 'מטות' },
  { name: 'Masei', hebrewName: 'מסעי' },
  // Deuteronomy
  { name: 'Devarim', hebrewName: 'דברים' },
  { name: 'Vaetchanan', hebrewName: 'ואתחנן' },
  { name: 'Eikev', hebrewName: 'עקב' },
  { name: "Re'eh", hebrewName: 'ראה' },
  { name: 'Shoftim', hebrewName: 'שופטים' },
  { name: 'Ki Teitzei', hebrewName: 'כי תצא' },
  { name: 'Ki Tavo', hebrewName: 'כי תבוא' },
  { name: 'Nitzavim', hebrewName: 'נצבים' },
  { name: 'Vayeilech', hebrewName: 'וילך' },
  { hebcal: "Ha'azinu", name: "Ha'Azinu", hebrewName: 'האזינו' },
  { hebcal: 'Vezot Haberakhah', name: "V'Zot HaBerachah", hebrewName: 'וזאת הברכה' },
];

/**
 * The occasions outside the weekly cycle that have a haftarah of their own,
 * tied to their key in hebcal's holiday table.
 *
 * hebcal keys some occasions by the calendar accident that produces them, so a
 * few need explanation. It lists a separate entry for a festival day that
 * falls on Shabbat, but those name the same haftarah, so the plain key is
 * taken. It keys Chanukah by which of the eight days lands on Shabbat: days
 * one through seven all read Zechariah, so day one stands for the first
 * Shabbat of the festival, and the second Shabbat can only be day eight. It
 * has no separate entry for the afternoon of the Ninth of Av, which therefore
 * shares the general fast-day afternoon reading.
 */
const OCCASIONS: Array<{
  hebcal: string;
  name: string;
  hebrewName: string;
  category: SpecialOccasion['category'];
}> = [
  {
    hebcal: 'Rosh Hashana I',
    name: 'Rosh Hashanah, Day 1',
    hebrewName: 'ראש השנה יום א׳',
    category: 'high-holidays',
  },
  {
    hebcal: 'Rosh Hashana II',
    name: 'Rosh Hashanah, Day 2',
    hebrewName: 'ראש השנה יום ב׳',
    category: 'high-holidays',
  },
  {
    hebcal: 'Shabbat Shuva',
    name: 'Shabbat Shuvah',
    hebrewName: 'שבת שובה',
    category: 'high-holidays',
  },
  {
    hebcal: 'Yom Kippur',
    name: 'Yom Kippur, Morning',
    hebrewName: 'יום כיפור שחרית',
    category: 'high-holidays',
  },
  {
    hebcal: 'Yom Kippur (Mincha, Traditional)',
    name: 'Yom Kippur, Afternoon',
    hebrewName: 'יום כיפור מנחה',
    category: 'high-holidays',
  },
  { hebcal: 'Sukkot I', name: 'Sukkot, Day 1', hebrewName: 'סוכות יום א׳', category: 'sukkot' },
  { hebcal: 'Sukkot II', name: 'Sukkot, Day 2', hebrewName: 'סוכות יום ב׳', category: 'sukkot' },
  {
    hebcal: 'Sukkot Shabbat Chol ha-Moed',
    name: 'Sukkot, Intermediate Sabbath',
    hebrewName: 'שבת חול המועד סוכות',
    category: 'sukkot',
  },
  {
    hebcal: 'Shmini Atzeret',
    name: 'Shemini Atzeret',
    hebrewName: 'שמיני עצרת',
    category: 'sukkot',
  },
  { hebcal: 'Simchat Torah', name: 'Simchat Torah', hebrewName: 'שמחת תורה', category: 'sukkot' },
  {
    hebcal: 'Chanukah Day 1 (on Shabbat)',
    name: 'Chanukkah, First Sabbath',
    hebrewName: 'שבת חנוכה א׳',
    category: 'other',
  },
  {
    hebcal: 'Chanukah Day 8 (on Shabbat)',
    name: 'Chanukkah, Second Sabbath',
    hebrewName: 'שבת חנוכה ב׳',
    category: 'other',
  },
  {
    hebcal: 'Shabbat Shekalim',
    name: 'Sheqalim',
    hebrewName: 'שבת שקלים',
    category: 'four-shabbatot',
  },
  { hebcal: 'Shabbat Zachor', name: 'Zakhor', hebrewName: 'שבת זכור', category: 'four-shabbatot' },
  { hebcal: 'Shabbat Parah', name: 'Parah', hebrewName: 'שבת פרה', category: 'four-shabbatot' },
  {
    hebcal: 'Shabbat HaChodesh',
    name: 'Ha-Chodesh',
    hebrewName: 'שבת החודש',
    category: 'four-shabbatot',
  },
  {
    hebcal: 'Shabbat HaGadol',
    name: 'Shabbat Ha-Gadol',
    hebrewName: 'שבת הגדול',
    category: 'other',
  },
  { hebcal: 'Pesach I', name: 'Passover, Day 1', hebrewName: 'פסח יום א׳', category: 'pesach' },
  { hebcal: 'Pesach II', name: 'Passover, Day 2', hebrewName: 'פסח יום ב׳', category: 'pesach' },
  {
    hebcal: 'Pesach Shabbat Chol ha-Moed',
    name: 'Passover, Intermediate Sabbath',
    hebrewName: 'שבת חול המועד פסח',
    category: 'pesach',
  },
  { hebcal: 'Pesach VII', name: 'Passover, Day 7', hebrewName: 'פסח יום ז׳', category: 'pesach' },
  { hebcal: 'Pesach VIII', name: 'Passover, Day 8', hebrewName: 'פסח יום ח׳', category: 'pesach' },
  {
    hebcal: 'Shavuot I',
    name: "Shavu'ot, Day 1",
    hebrewName: 'שבועות יום א׳',
    category: 'shavuot',
  },
  {
    hebcal: 'Shavuot II',
    name: "Shavu'ot, Day 2",
    hebrewName: 'שבועות יום ב׳',
    category: 'shavuot',
  },
  {
    hebcal: "Tish'a B'Av",
    name: "Tisha B'Av, Morning",
    hebrewName: 'תשעה באב שחרית',
    category: 'fast-days',
  },
  {
    hebcal: 'Fast Day (Afternoon)',
    name: "Tisha B'Av, Afternoon",
    hebrewName: 'תשעה באב מנחה',
    category: 'fast-days',
  },
  {
    hebcal: 'Fast Day (Afternoon)',
    name: 'Minor Fasts, Afternoon',
    hebrewName: 'צום קל מנחה',
    category: 'fast-days',
  },
  {
    hebcal: 'Shabbat Machar Chodesh',
    name: 'Shabbat on Eve of Rosh Chodesh',
    hebrewName: 'שבת מחר חודש',
    category: 'rosh-chodesh',
  },
  {
    hebcal: 'Shabbat Rosh Chodesh',
    name: 'Shabbat Rosh Chodesh',
    hebrewName: 'שבת ראש חודש',
    category: 'rosh-chodesh',
  },
];

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

  const aliyot = await readJson<Record<string, HebcalParsha>>('../data/hebcal/aliyot.json');
  const holidays = await readJson<Record<string, HebcalHoliday>>(
    '../data/hebcal/holiday-readings.json',
  );
  const structure = await readJson<TanakhStructure>('../public/data/tanakh-structure.json');

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

  const parshiot: Parsha[] = PARSHIOT.map(({ hebcal, name, hebrewName }) => {
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

  const specialOccasions: SpecialOccasion[] = OCCASIONS.map(
    ({ hebcal, name, hebrewName, category }) => {
      const entry = holidays[hebcal];
      if (!entry) {
        throw new Error(`hebcal has no occasion named "${hebcal}" (for ${name})`);
      }
      if (!entry.haft) {
        throw new Error(`hebcal records no haftarah for "${hebcal}"`);
      }

      const haftarah = readBothCustoms(entry, name);

      check(haftarah.ashkenazi, `${name} Ashkenazi`);
      check(haftarah.sephardi, `${name} Sephardi`);

      console.log(`${name} (${hebrewName}) [${category}]`);
      console.log(`  Ashkenazi: ${describe(haftarah.ashkenazi)}`);
      if (JSON.stringify(haftarah.sephardi) !== JSON.stringify(haftarah.ashkenazi)) {
        console.log(`  Sephardi:  ${describe(haftarah.sephardi)}`);
      }

      return { name, hebrewName, category, haftarah };
    },
  );

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} reference(s) did not check out:`);
    for (const message of errors) console.error(`   ${message}`);
    process.exit(1);
  }

  console.log('\n✅ Every reference checks out against tanakh-structure.json');

  const outputPath = new URL('../public/data/haftarah-mappings.json', import.meta.url);
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
