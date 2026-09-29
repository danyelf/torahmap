// What each print shows: every verse's position and colours, the titles, and
// the key, as plain data for draw().

import { readFileSync } from 'node:fs';
import { BAND_OFFSET, MULTICOLOR_GROWTH, SQUARE_GAP } from '../../src/geometry.ts';
import {
  deriveHaftarah,
  loadReadings,
  type HaftarahDerivation,
  type HaftarahItem,
} from '../../src/overlays/haftarah/readings.ts';
import {
  findLexemesForWord,
  getLexeme,
  loadLexiconData,
  searchByLexemes,
} from '../../src/search.ts';
import { tanakhKey, type Book, type TanakhLayout, type TorahData } from '../../src/types.ts';
import {
  INK,
  INK_SOFT,
  nameInk,
  NAME_HUES,
  PAPER,
  paleTaupe,
  readingColours,
  walnut,
} from './colour.ts';
import { printLayout } from './layout.ts';
import type {
  BookTitle,
  Key,
  KeyColumn,
  KeyRow,
  ProofInput,
  SectionTitle,
  SheetInput,
} from './types.ts';

const PALETTE = { paper: PAPER, ink: INK, inkSoft: INK_SOFT };

const SECTION_NAMES = {
  torah: { he: 'תורה', en: 'Five Books' },
  neviim: { he: 'נביאים', en: 'Prophets' },
  ketuvim: { he: 'כתובים', en: 'Writings' },
} as const;

export function loadStructure(): TorahData {
  return JSON.parse(readFileSync('public/data/tanakh-structure.json', 'utf8'));
}

function titles(verses: TanakhLayout[], books: Book[]) {
  const bookBox = new Map<string, BookTitle>();
  const sectionBox = new Map<Book['section'], SectionTitle>();
  const sectionOf = new Map(books.map((b) => [b.name, b.section]));
  const hebrew = new Map(books.map((b) => [b.name, b.hebrewName]));
  for (const v of verses) {
    const b = bookBox.get(v.book) ?? {
      he: hebrew.get(v.book)!,
      en: v.book,
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
    };
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    bookBox.set(v.book, b);

    const section = sectionOf.get(v.book)!;
    const s = sectionBox.get(section) ?? {
      ...SECTION_NAMES[section],
      maxX: -Infinity,
      minY: Infinity,
    };
    s.maxX = Math.max(s.maxX, v.x + v.size);
    s.minY = Math.min(s.minY, v.y);
    sectionBox.set(section, s);
  }
  const torah = verses.filter((v) => sectionOf.get(v.book) === 'torah');
  return {
    books: [...bookBox.values()],
    sections: [...sectionBox.values()],
    torahMinX: Math.min(...torah.map((v) => v.x)),
    torahTopY: Math.min(...torah.map((v) => v.y)),
  };
}

function sheet(
  layout: TanakhLayout[],
  structure: TorahData,
  fillsOf: (v: TanakhLayout, i: number) => string[],
  key: Key,
  credits: string,
  marks: boolean,
): SheetInput {
  return {
    kind: 'sheet',
    palette: PALETTE,
    verses: layout.map((v, i) => ({
      x: v.x,
      y: v.y,
      side: v.size - SQUARE_GAP,
      fills: fillsOf(v, i),
    })),
    ...titles(layout, structure.books),
    logoSvg: readFileSync('src/mapTitle.svg', 'utf8'),
    key,
    credits,
    bandOffset: BAND_OFFSET,
    growth: MULTICOLOR_GROWTH,
    marks,
  };
}

const CATEGORY_NAMES: Record<string, string> = {
  'high-holidays': 'High Holy Days',
  sukkot: 'Sukkot',
  other: 'Other occasions',
  'four-shabbatot': 'The four Sabbaths',
  pesach: 'Pesach',
  shavuot: 'Shavuot',
  'fast-days': 'Fast days',
  'rosh-chodesh': 'New moon',
};

/** Two kinds of occasion to a column. */
export const OCCASION_COLUMNS = [
  ['high-holidays', 'sukkot'],
  ['other', 'four-shabbatot'],
  ['pesach', 'shavuot'],
  ['fast-days', 'rosh-chodesh'],
];

export function haftarahKey(derived: HaftarahDerivation, colours: string[], torah: Book[]): Key {
  const row = (item: HaftarahItem): KeyRow => ({
    swatch: colours[derived.items.indexOf(item)],
    he: item.hebrewName,
    en: item.name,
  });
  const portions: KeyColumn[] = torah.map((book) => ({
    heading: { he: book.hebrewName, en: book.name },
    width: 170,
    groups: [
      {
        rows: derived.items.filter((i) => 'torah' in i && i.torah.book === book.name).map(row),
      },
    ],
  }));
  const occasions = derived.items.filter((i) => !('torah' in i));
  for (const item of occasions) {
    const category = 'category' in item ? item.category : '';
    if (!OCCASION_COLUMNS.flat().includes(category)) {
      throw new Error(`The key has no column for "${category}" (${item.name}).`);
    }
  }
  const occasionColumns: KeyColumn[] = OCCASION_COLUMNS.map((kinds) => ({
    width: 270,
    groups: kinds.map((kind) => ({
      heading: CATEGORY_NAMES[kind],
      rows: occasions.filter((i) => 'category' in i && i.category === kind).map(row),
    })),
  }));
  return {
    he: 'הפטרות',
    en: 'Haftarot · the prophetic readings',
    notes: [
      'Each week’s Torah portion and the passage from the Prophets read after it share a colour; the holidays and special Sabbaths continue around the wheel.',
      'A verse read on more than one occasion is split corner to corner, one band for each reading. Verses in no reading are brown. Ashkenazi custom.',
    ],
    columns: [...portions, ...occasionColumns],
  };
}

export async function haftarahSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  await loadReadings();
  const derived = deriveHaftarah('ashkenazi');
  if (derived.items.length === 0) throw new Error('The haftarah readings did not load.');
  const colours = readingColours(derived.items.length);
  const colourOf = (item: HaftarahItem) => colours[derived.items.indexOf(item)];
  // As colorAt in src/overlays/haftarah.ts: a Torah verse shows its portion,
  // any other verse every reading it is part of.
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = tanakhKey(v.book, v.chapter, v.verse);
    const parsha = derived.torahVerseToParsha.get(key);
    const items = parsha ? [parsha] : (derived.haftarahVerseToItem.get(key) ?? []);
    return items.length ? items.map(colourOf) : [walnut(i)];
  };
  return sheet(
    printLayout(structure),
    structure,
    fillsOf,
    haftarahKey(
      derived,
      colours,
      structure.books.filter((b) => b.section === 'torah'),
    ),
    'torahmap.org · Text of the Tanakh from Sefaria · Haftarah tables from hebcal',
    marks,
  );
}

const NAMES = [
  { he: 'אברהם', en: 'Abraham' },
  { he: 'יצחק', en: 'Isaac' },
  { he: 'יעקב', en: 'Jacob' },
  { he: 'משה', en: 'Moses' },
  { he: 'דוד', en: 'David' },
];

/**
 * The verses naming a person: only the dictionary entries for the written
 * form glossed as the name, so יצחק marks Isaac and never "laugh".
 */
export function nameVerses(he: string, gloss: string): Set<string> {
  const ids = (findLexemesForWord(he) ?? []).filter((id) => getLexeme(id)?.gloss === gloss);
  if (ids.length === 0) throw new Error(`No dictionary entry for ${he} glossed "${gloss}".`);
  return searchByLexemes(ids);
}

export async function searchSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  await loadLexiconData();
  const sets = NAMES.map((n) => nameVerses(n.he, n.en));
  const inks = NAME_HUES.map((_, i) => nameInk(i));
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = tanakhKey(v.book, v.chapter, v.verse);
    const named = inks.filter((_, k) => sets[k].has(key));
    return named.length ? named : [paleTaupe(i)];
  };
  const key: Key = {
    he: 'אבות ומנהיגים',
    en: 'Five names',
    notes: [
      'Every verse that names each of them is marked in their colour; a verse naming two is split corner to corner, one band each.',
      'Only the names: where Isaac’s name is also the word “laugh”, or David’s the word “beloved”, the word is left unmarked.',
    ],
    columns: [
      {
        width: 300,
        groups: [
          {
            rows: NAMES.map((n, k) => ({
              swatch: inks[k],
              he: n.he,
              en: n.en,
              note: `${sets[k].size} verses`,
            })),
          },
        ],
      },
    ],
  };
  return sheet(
    printLayout(structure),
    structure,
    fillsOf,
    key,
    'torahmap.org · Text of the Tanakh from Sefaria · Dictionary from the ETCBC BHSA',
    marks,
  );
}

/** Two patches of the map at print scale, and every colour the prints use. */
export function proofInput(haftarah: SheetInput, search: SheetInput, scale: number): ProofInput {
  const readings = haftarah.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  const names = search.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  return {
    kind: 'proof',
    palette: PALETTE,
    scale,
    patches: [
      { title: 'Haftarah · Isaiah 40–60', verses: haftarah.verses, centre: { x: 1400, y: 880 } },
      { title: 'Five names · Genesis 22–32', verses: search.verses, centre: { x: 3200, y: 220 } },
    ],
    swatches: [
      { fill: PAPER, label: `paper ${PAPER}` },
      { fill: INK, label: `ink ${INK}` },
      { fill: INK_SOFT, label: `quiet ${INK_SOFT}` },
      ...[0, 1, 2].map((i) => ({ fill: walnut(i), label: `unread ${walnut(i)}` })),
      ...[0, 1, 2].map((i) => ({ fill: paleTaupe(i), label: `unnamed ${paleTaupe(i)}` })),
      ...names.map((r) => ({ fill: r.swatch, label: `${r.en} ${r.swatch}` })),
      ...readings.map((r) => ({ fill: r.swatch, label: `${r.en} ${r.swatch}` })),
    ],
    bandOffset: haftarah.bandOffset,
    growth: haftarah.growth,
  };
}
