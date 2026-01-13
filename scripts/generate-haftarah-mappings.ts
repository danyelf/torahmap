/**
 * Generates haftarah-mappings.json with all 54 Torah portions and their haftarot.
 *
 * Uses hardcoded traditional data for reliability - these mappings are fixed
 * and don't change. Supports both Ashkenazi and Sephardi customs.
 *
 * Data sources:
 * - Standard Jewish liturgical calendar
 * - Ashkenazi and Sephardi haftarah traditions
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

// Special occasions only have haftarah, no Torah reading (Torah is determined by the occasion)
interface SpecialOccasion {
  name: string;
  hebrewName: string;
  category: 'rosh-chodesh' | 'four-shabbatot' | 'high-holidays' | 'sukkot' | 'pesach' | 'shavuot' | 'fast-days' | 'other';
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

// Helper to create verse range
function r(
  book: string,
  startCh: number,
  startV: number,
  endCh: number,
  endV: number
): VerseRange {
  return {
    book,
    start: { chapter: startCh, verse: startV },
    end: { chapter: endCh, verse: endV },
  };
}

// Shorthand for single-chapter range
function r1(book: string, ch: number, startV: number, endV: number): VerseRange {
  return r(book, ch, startV, ch, endV);
}

// All 54 parshiot with their Torah portions and haftarot
// Data compiled from traditional Jewish sources
const PARSHIOT: Parsha[] = [
  // BERESHIT / GENESIS
  {
    name: "Bereshit",
    hebrewName: "בראשית",
    torah: r("Genesis", 1, 1, 6, 8),
    haftarah: {
      ashkenazi: [r1("Isaiah", 42, 5, 21)],
      sephardi: [r("Isaiah", 42, 5, 43, 10)],
    },
  },
  {
    name: "Noach",
    hebrewName: "נח",
    torah: r("Genesis", 6, 9, 11, 32),
    haftarah: {
      ashkenazi: [r("Isaiah", 54, 1, 55, 5)],
      sephardi: [r1("Isaiah", 54, 1, 10)],
    },
  },
  {
    name: "Lech-Lecha",
    hebrewName: "לך־לך",
    torah: r("Genesis", 12, 1, 17, 27),
    haftarah: {
      ashkenazi: [r("Isaiah", 40, 27, 41, 16)],
      sephardi: [r("Isaiah", 40, 27, 41, 16)],
    },
  },
  {
    name: "Vayera",
    hebrewName: "וירא",
    torah: r("Genesis", 18, 1, 22, 24),
    haftarah: {
      ashkenazi: [r1("II Kings", 4, 1, 37)],
      sephardi: [r1("II Kings", 4, 1, 23)],
    },
  },
  {
    name: "Chayei Sara",
    hebrewName: "חיי שרה",
    torah: r("Genesis", 23, 1, 25, 18),
    haftarah: {
      ashkenazi: [r1("I Kings", 1, 1, 31)],
      sephardi: [r1("I Kings", 1, 1, 31)],
    },
  },
  {
    name: "Toldot",
    hebrewName: "תולדות",
    torah: r("Genesis", 25, 19, 28, 9),
    haftarah: {
      ashkenazi: [r("Malachi", 1, 1, 2, 7)],
      sephardi: [r("Malachi", 1, 1, 2, 7)],
    },
  },
  {
    name: "Vayetzei",
    hebrewName: "ויצא",
    torah: r("Genesis", 28, 10, 32, 3),
    haftarah: {
      ashkenazi: [r("Hosea", 12, 13, 14, 10)],
      sephardi: [r("Hosea", 11, 7, 12, 12)],
    },
  },
  {
    name: "Vayishlach",
    hebrewName: "וישלח",
    torah: r("Genesis", 32, 4, 36, 43),
    haftarah: {
      ashkenazi: [r1("Obadiah", 1, 1, 21)],
      sephardi: [r1("Obadiah", 1, 1, 21)],
    },
  },
  {
    name: "Vayeshev",
    hebrewName: "וישב",
    torah: r("Genesis", 37, 1, 40, 23),
    haftarah: {
      ashkenazi: [r1("Amos", 2, 6, 16)],
      sephardi: [r("Amos", 2, 6, 3, 8)],
    },
  },
  {
    name: "Miketz",
    hebrewName: "מקץ",
    torah: r("Genesis", 41, 1, 44, 17),
    haftarah: {
      ashkenazi: [r("I Kings", 3, 15, 4, 1)],
      sephardi: [r("I Kings", 3, 15, 4, 1)],
    },
  },
  {
    name: "Vayigash",
    hebrewName: "ויגש",
    torah: r("Genesis", 44, 18, 47, 27),
    haftarah: {
      ashkenazi: [r1("Ezekiel", 37, 15, 28)],
      sephardi: [r1("Ezekiel", 37, 15, 28)],
    },
  },
  {
    name: "Vayechi",
    hebrewName: "ויחי",
    torah: r("Genesis", 47, 28, 50, 26),
    haftarah: {
      ashkenazi: [r1("I Kings", 2, 1, 12)],
      sephardi: [r1("I Kings", 2, 1, 12)],
    },
  },

  // SHEMOT / EXODUS
  {
    name: "Shemot",
    hebrewName: "שמות",
    torah: r("Exodus", 1, 1, 6, 1),
    haftarah: {
      ashkenazi: [r("Isaiah", 27, 6, 28, 13), r("Isaiah", 29, 22, 29, 23)],
      sephardi: [r1("Jeremiah", 1, 1, 19)],
    },
  },
  {
    name: "Vaera",
    hebrewName: "וארא",
    torah: r("Exodus", 6, 2, 9, 35),
    haftarah: {
      ashkenazi: [r("Ezekiel", 28, 25, 29, 21)],
      sephardi: [r("Ezekiel", 28, 25, 29, 21)],
    },
  },
  {
    name: "Bo",
    hebrewName: "בא",
    torah: r("Exodus", 10, 1, 13, 16),
    haftarah: {
      ashkenazi: [r1("Jeremiah", 46, 13, 28)],
      sephardi: [r1("Jeremiah", 46, 13, 28)],
    },
  },
  {
    name: "Beshalach",
    hebrewName: "בשלח",
    torah: r("Exodus", 13, 17, 17, 16),
    haftarah: {
      ashkenazi: [r1("Judges", 4, 4, 24)],
      sephardi: [r("Judges", 4, 4, 5, 31)],
    },
  },
  {
    name: "Yitro",
    hebrewName: "יתרו",
    torah: r("Exodus", 18, 1, 20, 23),
    haftarah: {
      ashkenazi: [r("Isaiah", 6, 1, 7, 6), r1("Isaiah", 9, 5, 6)],
      sephardi: [r("Isaiah", 6, 1, 7, 6), r1("Isaiah", 9, 5, 6)],
    },
  },
  {
    name: "Mishpatim",
    hebrewName: "משפטים",
    torah: r("Exodus", 21, 1, 24, 18),
    haftarah: {
      ashkenazi: [r1("Jeremiah", 34, 8, 22), r1("Jeremiah", 33, 25, 26)],
      sephardi: [r1("Jeremiah", 34, 8, 22), r1("Jeremiah", 33, 25, 26)],
    },
  },
  {
    name: "Terumah",
    hebrewName: "תרומה",
    torah: r("Exodus", 25, 1, 27, 19),
    haftarah: {
      ashkenazi: [r("I Kings", 5, 26, 6, 13)],
      sephardi: [r("I Kings", 5, 26, 6, 13)],
    },
  },
  {
    name: "Tetzaveh",
    hebrewName: "תצוה",
    torah: r("Exodus", 27, 20, 30, 10),
    haftarah: {
      ashkenazi: [r1("Ezekiel", 43, 10, 27)],
      sephardi: [r1("Ezekiel", 43, 10, 27)],
    },
  },
  {
    name: "Ki Tisa",
    hebrewName: "כי תשא",
    torah: r("Exodus", 30, 11, 34, 35),
    haftarah: {
      ashkenazi: [r1("I Kings", 18, 1, 39)],
      sephardi: [r1("I Kings", 18, 20, 39)],
    },
  },
  {
    name: "Vayakhel",
    hebrewName: "ויקהל",
    torah: r("Exodus", 35, 1, 38, 20),
    haftarah: {
      ashkenazi: [r1("I Kings", 7, 40, 50)],
      sephardi: [r1("I Kings", 7, 13, 26)],
    },
  },
  {
    name: "Pekudei",
    hebrewName: "פקודי",
    torah: r("Exodus", 38, 21, 40, 38),
    haftarah: {
      ashkenazi: [r("I Kings", 7, 51, 8, 21)],
      sephardi: [r1("I Kings", 7, 40, 50)],
    },
  },

  // VAYIKRA / LEVITICUS
  {
    name: "Vayikra",
    hebrewName: "ויקרא",
    torah: r("Leviticus", 1, 1, 5, 26),
    haftarah: {
      ashkenazi: [r1("Isaiah", 43, 21, 28)],
      sephardi: [r("Isaiah", 43, 21, 44, 23)],
    },
  },
  {
    name: "Tzav",
    hebrewName: "צו",
    torah: r("Leviticus", 6, 1, 8, 36),
    haftarah: {
      ashkenazi: [r1("Jeremiah", 7, 21, 28), r("Jeremiah", 9, 22, 9, 23)],
      sephardi: [r1("Jeremiah", 7, 21, 34)],
    },
  },
  {
    name: "Shemini",
    hebrewName: "שמיני",
    torah: r("Leviticus", 9, 1, 11, 47),
    haftarah: {
      ashkenazi: [r("II Samuel", 6, 1, 7, 17)],
      sephardi: [r1("II Samuel", 6, 1, 19)],
    },
  },
  {
    name: "Tazria",
    hebrewName: "תזריע",
    torah: r("Leviticus", 12, 1, 13, 59),
    haftarah: {
      ashkenazi: [r("II Kings", 4, 42, 5, 19)],
      sephardi: [r("II Kings", 4, 42, 5, 19)],
    },
  },
  {
    name: "Metzora",
    hebrewName: "מצורע",
    torah: r("Leviticus", 14, 1, 15, 33),
    haftarah: {
      ashkenazi: [r1("II Kings", 7, 3, 20)],
      sephardi: [r1("II Kings", 7, 3, 20)],
    },
  },
  {
    name: "Achrei Mot",
    hebrewName: "אחרי מות",
    torah: r("Leviticus", 16, 1, 18, 30),
    haftarah: {
      ashkenazi: [r1("Ezekiel", 22, 1, 19)],
      sephardi: [r1("Ezekiel", 22, 1, 16)],
    },
  },
  {
    name: "Kedoshim",
    hebrewName: "קדושים",
    torah: r("Leviticus", 19, 1, 20, 27),
    haftarah: {
      ashkenazi: [r1("Amos", 9, 7, 15)],
      sephardi: [r1("Ezekiel", 20, 2, 20)],
    },
  },
  {
    name: "Emor",
    hebrewName: "אמור",
    torah: r("Leviticus", 21, 1, 24, 23),
    haftarah: {
      ashkenazi: [r1("Ezekiel", 44, 15, 31)],
      sephardi: [r1("Ezekiel", 44, 15, 31)],
    },
  },
  {
    name: "Behar",
    hebrewName: "בהר",
    torah: r("Leviticus", 25, 1, 26, 2),
    haftarah: {
      ashkenazi: [r1("Jeremiah", 32, 6, 27)],
      sephardi: [r1("Jeremiah", 32, 6, 22)],
    },
  },
  {
    name: "Bechukotai",
    hebrewName: "בחוקותי",
    torah: r("Leviticus", 26, 3, 27, 34),
    haftarah: {
      ashkenazi: [r("Jeremiah", 16, 19, 17, 14)],
      sephardi: [r("Jeremiah", 16, 19, 17, 14)],
    },
  },

  // BAMIDBAR / NUMBERS
  {
    name: "Bamidbar",
    hebrewName: "במדבר",
    torah: r("Numbers", 1, 1, 4, 20),
    haftarah: {
      ashkenazi: [r1("Hosea", 2, 1, 22)],
      sephardi: [r1("Hosea", 2, 1, 22)],
    },
  },
  {
    name: "Nasso",
    hebrewName: "נשא",
    torah: r("Numbers", 4, 21, 7, 89),
    haftarah: {
      ashkenazi: [r1("Judges", 13, 2, 25)],
      sephardi: [r1("Judges", 13, 2, 25)],
    },
  },
  {
    name: "Behaalotcha",
    hebrewName: "בהעלותך",
    torah: r("Numbers", 8, 1, 12, 16),
    haftarah: {
      ashkenazi: [r("Zechariah", 2, 14, 4, 7)],
      sephardi: [r("Zechariah", 2, 14, 4, 7)],
    },
  },
  {
    name: "Shelach",
    hebrewName: "שלח",
    torah: r("Numbers", 13, 1, 15, 41),
    haftarah: {
      ashkenazi: [r1("Joshua", 2, 1, 24)],
      sephardi: [r1("Joshua", 2, 1, 24)],
    },
  },
  {
    name: "Korach",
    hebrewName: "קורח",
    torah: r("Numbers", 16, 1, 18, 32),
    haftarah: {
      ashkenazi: [r("I Samuel", 11, 14, 12, 22)],
      sephardi: [r("I Samuel", 11, 14, 12, 22)],
    },
  },
  {
    name: "Chukat",
    hebrewName: "חוקת",
    torah: r("Numbers", 19, 1, 22, 1),
    haftarah: {
      ashkenazi: [r1("Judges", 11, 1, 33)],
      sephardi: [r1("Judges", 11, 1, 33)],
    },
  },
  {
    name: "Balak",
    hebrewName: "בלק",
    torah: r("Numbers", 22, 2, 25, 9),
    haftarah: {
      ashkenazi: [r("Micah", 5, 6, 6, 8)],
      sephardi: [r("Micah", 5, 6, 6, 8)],
    },
  },
  {
    name: "Pinchas",
    hebrewName: "פינחס",
    torah: r("Numbers", 25, 10, 30, 1),
    haftarah: {
      ashkenazi: [r("I Kings", 18, 46, 19, 21)],
      sephardi: [r("I Kings", 18, 46, 19, 21)],
    },
  },
  {
    name: "Matot",
    hebrewName: "מטות",
    torah: r("Numbers", 30, 2, 32, 42),
    haftarah: {
      ashkenazi: [r("Jeremiah", 1, 1, 2, 3)],
      sephardi: [r1("Jeremiah", 1, 1, 19)],
    },
  },
  {
    name: "Masei",
    hebrewName: "מסעי",
    torah: r("Numbers", 33, 1, 36, 13),
    haftarah: {
      ashkenazi: [r1("Jeremiah", 2, 4, 28), r1("Jeremiah", 3, 4, 4)],
      sephardi: [r1("Jeremiah", 2, 4, 28), r1("Jeremiah", 4, 1, 2)],
    },
  },

  // DEVARIM / DEUTERONOMY
  {
    name: "Devarim",
    hebrewName: "דברים",
    torah: r("Deuteronomy", 1, 1, 3, 22),
    haftarah: {
      ashkenazi: [r1("Isaiah", 1, 1, 27)],
      sephardi: [r1("Isaiah", 1, 1, 27)],
    },
  },
  {
    name: "Vaetchanan",
    hebrewName: "ואתחנן",
    torah: r("Deuteronomy", 3, 23, 7, 11),
    haftarah: {
      ashkenazi: [r1("Isaiah", 40, 1, 26)],
      sephardi: [r1("Isaiah", 40, 1, 26)],
    },
  },
  {
    name: "Eikev",
    hebrewName: "עקב",
    torah: r("Deuteronomy", 7, 12, 11, 25),
    haftarah: {
      ashkenazi: [r1("Isaiah", 49, 14, 26)],
      sephardi: [r("Isaiah", 49, 14, 50, 10)],
    },
  },
  {
    name: "Reeh",
    hebrewName: "ראה",
    torah: r("Deuteronomy", 11, 26, 16, 17),
    haftarah: {
      ashkenazi: [r("Isaiah", 54, 11, 55, 5)],
      sephardi: [r("Isaiah", 54, 11, 55, 5)],
    },
  },
  {
    name: "Shoftim",
    hebrewName: "שופטים",
    torah: r("Deuteronomy", 16, 18, 21, 9),
    haftarah: {
      ashkenazi: [r1("Isaiah", 51, 12, 23)],
      sephardi: [r("Isaiah", 51, 12, 52, 12)],
    },
  },
  {
    name: "Ki Teitzei",
    hebrewName: "כי תצא",
    torah: r("Deuteronomy", 21, 10, 25, 19),
    haftarah: {
      ashkenazi: [r1("Isaiah", 54, 1, 10)],
      sephardi: [r("Isaiah", 54, 1, 55, 5)],
    },
  },
  {
    name: "Ki Tavo",
    hebrewName: "כי תבוא",
    torah: r("Deuteronomy", 26, 1, 29, 8),
    haftarah: {
      ashkenazi: [r1("Isaiah", 60, 1, 22)],
      sephardi: [r1("Isaiah", 60, 1, 22)],
    },
  },
  {
    name: "Nitzavim",
    hebrewName: "נצבים",
    torah: r("Deuteronomy", 29, 9, 30, 20),
    haftarah: {
      ashkenazi: [r("Isaiah", 61, 10, 63, 9)],
      sephardi: [r("Isaiah", 61, 10, 63, 9)],
    },
  },
  {
    name: "Vayeilech",
    hebrewName: "וילך",
    torah: r("Deuteronomy", 31, 1, 31, 30),
    haftarah: {
      ashkenazi: [r1("Hosea", 14, 2, 10), r1("Micah", 7, 18, 20)],
      sephardi: [r1("Hosea", 14, 2, 10), r1("Joel", 2, 15, 27)],
    },
  },
  {
    name: "Haazinu",
    hebrewName: "האזינו",
    torah: r("Deuteronomy", 32, 1, 32, 52),
    haftarah: {
      ashkenazi: [r1("II Samuel", 22, 1, 51)],
      sephardi: [r1("II Samuel", 22, 1, 51)],
    },
  },
  {
    name: "Vezot Haberachah",
    hebrewName: "וזאת הברכה",
    torah: r("Deuteronomy", 33, 1, 34, 12),
    haftarah: {
      ashkenazi: [r1("Joshua", 1, 1, 18)],
      sephardi: [r1("Joshua", 1, 1, 18)],
    },
  },
];

// Special occasions with their haftarot
// Data compiled from traditional Jewish sources
const SPECIAL_OCCASIONS: SpecialOccasion[] = [
  // ROSH CHODESH RELATED
  {
    name: "Shabbat Rosh Chodesh",
    hebrewName: "שבת ראש חודש",
    category: "rosh-chodesh",
    haftarah: {
      ashkenazi: [r1("Isaiah", 66, 1, 24)],
      sephardi: [r1("Isaiah", 66, 1, 24)],
    },
  },
  {
    name: "Shabbat Machar Chodesh",
    hebrewName: "שבת מחר חודש",
    category: "rosh-chodesh",
    haftarah: {
      ashkenazi: [r1("I Samuel", 20, 18, 42)],
      sephardi: [r1("I Samuel", 20, 18, 42)],
    },
  },

  // FOUR SPECIAL SHABBATOT
  {
    name: "Shabbat Shekalim",
    hebrewName: "שבת שקלים",
    category: "four-shabbatot",
    haftarah: {
      ashkenazi: [r1("II Kings", 12, 1, 17)],
      sephardi: [r("II Kings", 11, 17, 12, 17)],
    },
  },
  {
    name: "Shabbat Zachor",
    hebrewName: "שבת זכור",
    category: "four-shabbatot",
    haftarah: {
      ashkenazi: [r1("I Samuel", 15, 2, 34)],
      sephardi: [r1("I Samuel", 15, 1, 34)],
    },
  },
  {
    name: "Shabbat Parah",
    hebrewName: "שבת פרה",
    category: "four-shabbatot",
    haftarah: {
      ashkenazi: [r1("Ezekiel", 36, 16, 38)],
      sephardi: [r1("Ezekiel", 36, 16, 36)],
    },
  },
  {
    name: "Shabbat HaChodesh",
    hebrewName: "שבת החודש",
    category: "four-shabbatot",
    haftarah: {
      ashkenazi: [r("Ezekiel", 45, 16, 46, 18)],
      sephardi: [r("Ezekiel", 45, 18, 46, 15)],
    },
  },

  // HIGH HOLIDAYS
  {
    name: "Rosh Hashanah Day 1",
    hebrewName: "ראש השנה יום א׳",
    category: "high-holidays",
    haftarah: {
      ashkenazi: [r("I Samuel", 1, 1, 2, 10)],
      sephardi: [r("I Samuel", 1, 1, 2, 10)],
    },
  },
  {
    name: "Rosh Hashanah Day 2",
    hebrewName: "ראש השנה יום ב׳",
    category: "high-holidays",
    haftarah: {
      ashkenazi: [r1("Jeremiah", 31, 2, 20)],
      sephardi: [r1("Jeremiah", 31, 2, 20)],
    },
  },
  {
    name: "Yom Kippur Shacharit",
    hebrewName: "יום כיפור שחרית",
    category: "high-holidays",
    haftarah: {
      ashkenazi: [r("Isaiah", 57, 14, 58, 14)],
      sephardi: [r("Isaiah", 57, 14, 58, 14)],
    },
  },
  {
    name: "Yom Kippur Mincha",
    hebrewName: "יום כיפור מנחה",
    category: "high-holidays",
    haftarah: {
      ashkenazi: [r("Jonah", 1, 1, 4, 11), r1("Micah", 7, 18, 20)],
      sephardi: [r("Jonah", 1, 1, 4, 11), r1("Micah", 7, 18, 20)],
    },
  },

  // SUKKOT
  {
    name: "Sukkot Day 1",
    hebrewName: "סוכות יום א׳",
    category: "sukkot",
    haftarah: {
      ashkenazi: [r1("Zechariah", 14, 1, 21)],
      sephardi: [r1("Zechariah", 14, 1, 21)],
    },
  },
  {
    name: "Sukkot Day 2",
    hebrewName: "סוכות יום ב׳",
    category: "sukkot",
    haftarah: {
      ashkenazi: [r1("I Kings", 8, 2, 21)],
      sephardi: [r1("I Kings", 8, 2, 21)],
    },
  },
  {
    name: "Sukkot Chol HaMoed Shabbat",
    hebrewName: "שבת חול המועד סוכות",
    category: "sukkot",
    haftarah: {
      ashkenazi: [r("Ezekiel", 38, 18, 39, 16)],
      sephardi: [r("Ezekiel", 38, 18, 39, 16)],
    },
  },
  {
    name: "Shemini Atzeret",
    hebrewName: "שמיני עצרת",
    category: "sukkot",
    haftarah: {
      ashkenazi: [r("I Kings", 8, 54, 9, 1)],
      sephardi: [r("I Kings", 8, 54, 9, 1)],
    },
  },
  {
    name: "Simchat Torah",
    hebrewName: "שמחת תורה",
    category: "sukkot",
    haftarah: {
      ashkenazi: [r1("Joshua", 1, 1, 18)],
      sephardi: [r1("Joshua", 1, 1, 18)],
    },
  },

  // PESACH
  {
    name: "Pesach Day 1",
    hebrewName: "פסח יום א׳",
    category: "pesach",
    haftarah: {
      ashkenazi: [r("Joshua", 5, 2, 6, 1)],
      sephardi: [r("Joshua", 5, 2, 6, 27)],
    },
  },
  {
    name: "Pesach Day 2",
    hebrewName: "פסח יום ב׳",
    category: "pesach",
    haftarah: {
      ashkenazi: [r1("II Kings", 23, 1, 9), r1("II Kings", 23, 21, 25)],
      sephardi: [r1("II Kings", 23, 1, 9), r1("II Kings", 23, 21, 25)],
    },
  },
  {
    name: "Pesach Chol HaMoed Shabbat",
    hebrewName: "שבת חול המועד פסח",
    category: "pesach",
    haftarah: {
      ashkenazi: [r1("Ezekiel", 37, 1, 14)],
      sephardi: [r1("Ezekiel", 37, 1, 14)],
    },
  },
  {
    name: "Pesach Day 7",
    hebrewName: "פסח יום ז׳",
    category: "pesach",
    haftarah: {
      ashkenazi: [r1("II Samuel", 22, 1, 51)],
      sephardi: [r1("II Samuel", 22, 1, 51)],
    },
  },
  {
    name: "Pesach Day 8",
    hebrewName: "פסח יום ח׳",
    category: "pesach",
    haftarah: {
      ashkenazi: [r("Isaiah", 10, 32, 12, 6)],
      sephardi: [r("Isaiah", 10, 32, 12, 6)],
    },
  },

  // SHAVUOT
  {
    name: "Shavuot Day 1",
    hebrewName: "שבועות יום א׳",
    category: "shavuot",
    haftarah: {
      ashkenazi: [r1("Ezekiel", 1, 1, 28), r1("Ezekiel", 3, 12, 12)],
      sephardi: [r1("Ezekiel", 1, 1, 28)],
    },
  },
  {
    name: "Shavuot Day 2",
    hebrewName: "שבועות יום ב׳",
    category: "shavuot",
    haftarah: {
      ashkenazi: [r1("Habakkuk", 3, 1, 19)],
      sephardi: [r("Habakkuk", 2, 20, 3, 19)],
    },
  },

  // FAST DAYS
  {
    name: "Tisha B'Av Shacharit",
    hebrewName: "תשעה באב שחרית",
    category: "fast-days",
    haftarah: {
      ashkenazi: [r("Jeremiah", 8, 13, 9, 23)],
      sephardi: [r("Jeremiah", 8, 13, 9, 23)],
    },
  },
  {
    name: "Tisha B'Av Mincha",
    hebrewName: "תשעה באב מנחה",
    category: "fast-days",
    haftarah: {
      ashkenazi: [r("Isaiah", 55, 6, 56, 8)],
      sephardi: [r("Isaiah", 55, 6, 56, 8)],
    },
  },

  // OTHER SPECIAL SHABBATOT
  {
    name: "Shabbat Chanukah 1",
    hebrewName: "שבת חנוכה א׳",
    category: "other",
    haftarah: {
      ashkenazi: [r("Zechariah", 2, 14, 4, 7)],
      sephardi: [r("Zechariah", 2, 14, 4, 7)],
    },
  },
  {
    name: "Shabbat Chanukah 2",
    hebrewName: "שבת חנוכה ב׳",
    category: "other",
    haftarah: {
      ashkenazi: [r1("I Kings", 7, 40, 50)],
      sephardi: [r1("I Kings", 7, 40, 50)],
    },
  },
  {
    name: "Shabbat HaGadol",
    hebrewName: "שבת הגדול",
    category: "other",
    haftarah: {
      ashkenazi: [r1("Malachi", 3, 4, 24)],
      sephardi: [r1("Malachi", 3, 4, 24)],
    },
  },
];

// Load Tanakh structure to get chapter counts for validation
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

function validateVerseRange(range: VerseRange, structure: TanakhStructure, context: string): void {
  // Find the book
  const bookData = structure.books.find((b) => b.name === range.book);
  if (!bookData) {
    throw new Error(`${context}: Unknown book "${range.book}"`);
  }

  // Check that verse numbers are defined
  if (range.start.verse === undefined || range.start.verse === null) {
    throw new Error(`${context}: ${range.book} start verse is undefined/null`);
  }
  if (range.end.verse === undefined || range.end.verse === null) {
    throw new Error(`${context}: ${range.book} end verse is undefined/null`);
  }

  // Check chapter numbers are in valid range
  if (range.start.chapter < 1 || range.start.chapter > bookData.chapters.length) {
    throw new Error(
      `${context}: ${range.book} start chapter ${range.start.chapter} out of range (1-${bookData.chapters.length})`
    );
  }
  if (range.end.chapter < 1 || range.end.chapter > bookData.chapters.length) {
    throw new Error(
      `${context}: ${range.book} end chapter ${range.end.chapter} out of range (1-${bookData.chapters.length})`
    );
  }

  // Check verse numbers are in valid range for their chapters
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

  // Check that start comes before or equals end
  if (range.start.chapter > range.end.chapter) {
    throw new Error(
      `${context}: ${range.book} start chapter ${range.start.chapter} > end chapter ${range.end.chapter}`
    );
  }
  if (range.start.chapter === range.end.chapter && range.start.verse > range.end.verse) {
    throw new Error(
      `${context}: ${range.book} ${range.start.chapter}:${range.start.verse} > ${range.end.chapter}:${range.end.verse}`
    );
  }
}

async function main() {
  console.log("Generating haftarah mappings data...\n");

  // Load structure for validation
  const structure = await loadTanakhStructure();

  // Validate data
  let torahVerseCount = 0;
  let haftarahCount = 0;
  let specialOccasionCount = 0;
  let errors = 0;

  console.log("=== PARSHIOT ===\n");

  for (const parsha of PARSHIOT) {
    console.log(`${parsha.name} (${parsha.hebrewName})`);
    console.log(
      `  Torah: ${parsha.torah.book} ${parsha.torah.start.chapter}:${parsha.torah.start.verse}-${parsha.torah.end.chapter}:${parsha.torah.end.verse}`
    );

    // Validate Torah range
    try {
      validateVerseRange(parsha.torah, structure, `${parsha.name} Torah`);
    } catch (err) {
      console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    // Validate Ashkenazi haftarot
    for (let i = 0; i < parsha.haftarah.ashkenazi.length; i++) {
      const range = parsha.haftarah.ashkenazi[i];
      try {
        validateVerseRange(range, structure, `${parsha.name} Ashkenazi[${i}]`);
      } catch (err) {
        console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    }

    // Validate Sephardi haftarot
    for (let i = 0; i < parsha.haftarah.sephardi.length; i++) {
      const range = parsha.haftarah.sephardi[i];
      try {
        validateVerseRange(range, structure, `${parsha.name} Sephardi[${i}]`);
      } catch (err) {
        console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    }

    const ashkBooks = parsha.haftarah.ashkenazi.map((r) => r.book).join(", ");
    console.log(`  Haftarah (Ashk): ${ashkBooks}`);

    if (
      JSON.stringify(parsha.haftarah.ashkenazi) !==
      JSON.stringify(parsha.haftarah.sephardi)
    ) {
      const sephBooks = parsha.haftarah.sephardi.map((r) => r.book).join(", ");
      console.log(`  Haftarah (Seph): ${sephBooks}`);
    }

    torahVerseCount++;
    haftarahCount += parsha.haftarah.ashkenazi.length;
  }

  console.log("\n=== SPECIAL OCCASIONS ===\n");

  for (const occasion of SPECIAL_OCCASIONS) {
    console.log(`${occasion.name} (${occasion.hebrewName}) [${occasion.category}]`);

    // Validate Ashkenazi haftarot
    for (let i = 0; i < occasion.haftarah.ashkenazi.length; i++) {
      const range = occasion.haftarah.ashkenazi[i];
      try {
        validateVerseRange(range, structure, `${occasion.name} Ashkenazi[${i}]`);
      } catch (err) {
        console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    }

    // Validate Sephardi haftarot
    for (let i = 0; i < occasion.haftarah.sephardi.length; i++) {
      const range = occasion.haftarah.sephardi[i];
      try {
        validateVerseRange(range, structure, `${occasion.name} Sephardi[${i}]`);
      } catch (err) {
        console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    }

    const ashkBooks = occasion.haftarah.ashkenazi.map((r) => r.book).join(", ");
    console.log(`  Haftarah (Ashk): ${ashkBooks}`);

    if (
      JSON.stringify(occasion.haftarah.ashkenazi) !==
      JSON.stringify(occasion.haftarah.sephardi)
    ) {
      const sephBooks = occasion.haftarah.sephardi.map((r) => r.book).join(", ");
      console.log(`  Haftarah (Seph): ${sephBooks}`);
    }

    specialOccasionCount++;
    haftarahCount += occasion.haftarah.ashkenazi.length;
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
  const output = { parshiot: PARSHIOT, specialOccasions: SPECIAL_OCCASIONS };
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outputPath.pathname}`);

  // Summary
  console.log(`\nTotal parshiot: ${PARSHIOT.length}`);
  console.log(`Total special occasions: ${specialOccasionCount}`);
  console.log(`Total haftarah segments: ${haftarahCount}`);
  console.log(`Total items (parshiot + special occasions): ${PARSHIOT.length + specialOccasionCount}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
