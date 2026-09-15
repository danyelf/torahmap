// Quality checks on the generated haftarah mappings.
//
// The readings come from hebcal's leyning tables, vendored under
// data/overlays/haftarah/hebcal/.
// These tests read the generated file directly: they check that it still says
// what hebcal says, and that every reference it contains points at a verse the
// Tanakh actually has.
//
// Regenerate the file with:
//   npx tsx scripts/overlays/haftarah/generate.ts

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

interface VerseRef {
  chapter: number;
  verse: number;
}

interface VerseRange {
  book: string;
  start: VerseRef;
  end: VerseRef;
}

interface Reading {
  name: string;
  hebrewName: string;
  haftarah: { ashkenazi: VerseRange[]; sephardi: VerseRange[] };
}

interface Parsha extends Reading {
  torah: VerseRange;
}

const dataDir = path.join(process.cwd(), 'public', 'data');

const mappings = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'overlays', 'haftarah', 'mappings.json'), 'utf-8'),
) as { parshiot: Parsha[]; specialOccasions: Reading[] };

const structure = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'tanakh-structure.json'), 'utf-8'),
) as { books: Array<{ name: string; chapters: number[] }> };

/** "Isaiah 42:5-43:10", the form used in these tests' expectations. */
function format(ranges: VerseRange[]): string {
  return ranges
    .map((r) => `${r.book} ${r.start.chapter}:${r.start.verse}-${r.end.chapter}:${r.end.verse}`)
    .join(', ');
}

function parsha(name: string): Parsha {
  const found = mappings.parshiot.find((p) => p.name === name);
  if (!found) throw new Error(`No parsha named "${name}"`);
  return found;
}

function occasion(name: string): Reading {
  const found = mappings.specialOccasions.find((o) => o.name === name);
  if (!found) throw new Error(`No special occasion named "${name}"`);
  return found;
}

describe('the haftarah readings the app ships', () => {
  it('covers all 54 weekly portions', () => {
    expect(mappings.parshiot).toHaveLength(54);
  });

  it('keeps the portions in their order through the Torah', () => {
    const books = mappings.parshiot.map((p) => p.torah.book);
    expect(books[0]).toBe('Genesis');
    expect(books[books.length - 1]).toBe('Deuteronomy');

    const order = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
    const positions = books.map((b) => order.indexOf(b));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  // Four readings where hebcal and the previous source (Mechon Mamre)
  // disagree about which passage belongs to the portion. They stand here as
  // the marker that the file was built from hebcal: if someone regenerates it
  // from something else, these are the first assertions to break.
  describe('follows hebcal where the two sources disagree', () => {
    it('reads Obadiah for Vayishlach', () => {
      expect(format(parsha('Vayishlach').haftarah.ashkenazi)).toBe('Obadiah 1:1-1:21');
    });

    it('reads Amos for Achrei Mot, not Ezekiel', () => {
      expect(format(parsha('Achrei Mot').haftarah.ashkenazi)).toBe('Amos 9:7-9:15');
    });

    it('reads Ezekiel for Kedoshim, not Amos', () => {
      expect(format(parsha('Kedoshim').haftarah.ashkenazi)).toBe('Ezekiel 22:1-22:19');
    });

    it("gives Vayeilech its own reading rather than Shabbat Shuvah's", () => {
      expect(format(parsha('Vayeilech').haftarah.ashkenazi)).toBe('Isaiah 55:6-56:8');
    });
  });

  // The portions are named as Sefaria names them, so that a reference here and
  // a reference on Sefaria are the same string. These five are the spellings
  // that most obviously separate Sefaria's vocabulary from the transliteration
  // the map used before, and from hebcal's, which differs on three of its own.
  it('names the portions as Sefaria names them', () => {
    const named = (n: string) => mappings.parshiot.some((p) => p.name === n);
    for (const name of ['Bereshit', 'Lech Lecha', "Sh'lach", "Ha'Azinu", "V'Zot HaBerachah"]) {
      expect(named(name), `expected a portion named "${name}"`).toBe(true);
    }
  });

  it('names the portions in Hebrew as Sefaria does, defective spellings and all', () => {
    const hebrew = new Map(mappings.parshiot.map((p) => [p.name, p.hebrewName]));
    expect(hebrew.get('Chukat')).toBe('חקת');
    expect(hebrew.get('Korach')).toBe('קרח');
    expect(hebrew.get('Pinchas')).toBe('פנחס');
    expect(hebrew.get('Bechukotai')).toBe('בחוקתי');
    expect(hebrew.get('Lech Lecha')).toBe('לך לך');
  });

  describe('special occasions', () => {
    it('covers the same 29 occasions as before', () => {
      expect(mappings.specialOccasions).toHaveLength(29);
    });

    it('keeps the four special Shabbatot together', () => {
      const four = mappings.specialOccasions.filter(
        (o) => (o as Reading & { category: string }).category === 'four-shabbatot',
      );
      expect(four.map((o) => o.name)).toEqual(['Sheqalim', 'Zakhor', 'Parah', 'Ha-Chodesh']);
    });

    it('reads Jonah at Yom Kippur afternoon', () => {
      expect(format(occasion('Yom Kippur, Afternoon').haftarah.ashkenazi)).toBe(
        'Jonah 1:1-4:11, Micah 7:18-7:20',
      );
    });
  });

  describe('every reference points at a verse that exists', () => {
    const everyRange: Array<{ context: string; range: VerseRange }> = [];

    for (const p of mappings.parshiot) {
      everyRange.push({ context: `${p.name} Torah`, range: p.torah });
    }
    for (const item of [...mappings.parshiot, ...mappings.specialOccasions]) {
      for (const rite of ['ashkenazi', 'sephardi'] as const) {
        item.haftarah[rite].forEach((range, i) => {
          everyRange.push({ context: `${item.name} ${rite}[${i}]`, range });
        });
      }
    }

    it('names a book the Tanakh has', () => {
      const unknown = everyRange
        .filter(({ range }) => !structure.books.some((b) => b.name === range.book))
        .map(({ context, range }) => `${context}: ${range.book}`);
      expect(unknown).toEqual([]);
    });

    it('stays inside the chapter and verse counts of that book', () => {
      const outside: string[] = [];

      for (const { context, range } of everyRange) {
        const book = structure.books.find((b) => b.name === range.book);
        if (!book) continue;

        for (const end of ['start', 'end'] as const) {
          const { chapter, verse } = range[end];
          const verseCount = book.chapters[chapter - 1];
          if (chapter < 1 || chapter > book.chapters.length) {
            outside.push(`${context}: ${range.book} has no chapter ${chapter}`);
          } else if (verse < 1 || verse > verseCount) {
            outside.push(
              `${context}: ${range.book} ${chapter} has ${verseCount} verses, not ${verse}`,
            );
          }
        }
      }

      expect(outside).toEqual([]);
    });

    it('never ends before it starts', () => {
      const backwards = everyRange
        .filter(
          ({ range }) =>
            range.start.chapter > range.end.chapter ||
            (range.start.chapter === range.end.chapter && range.start.verse > range.end.verse),
        )
        .map(({ context }) => context);
      expect(backwards).toEqual([]);
    });
  });

  describe('every reading is complete', () => {
    it('gives each portion a passage for both customs', () => {
      const missing = [...mappings.parshiot, ...mappings.specialOccasions]
        .filter(
          (item) => item.haftarah.ashkenazi.length === 0 || item.haftarah.sephardi.length === 0,
        )
        .map((item) => item.name);
      expect(missing).toEqual([]);
    });

    it('names each portion in Hebrew as well as English', () => {
      const missing = [...mappings.parshiot, ...mappings.specialOccasions]
        .filter((item) => !item.hebrewName || item.hebrewName === item.name)
        .map((item) => item.name);
      expect(missing).toEqual([]);
    });
  });
});
