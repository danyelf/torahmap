// What each print shows: every verse's position and colours, the titles, and
// the key, as plain data for draw().

import { readFileSync } from 'node:fs';
import { BAND_OFFSET, MULTICOLOR_GROWTH, SQUARE_GAP } from '../../src/geometry.ts';
import { loadNamedFiles } from '../../src/dataFiles.ts';
import { STRUCTURE_FILE, TEXTS_FILE, type VerseTexts } from '../../src/verseTexts.ts';
import {
  deriveHaftarah,
  HAFTARAH_FILES,
  type HaftarahData,
  type HaftarahDerivation,
  type HaftarahItem,
} from '../../src/overlays/haftarah/readings.ts';
import {
  buildDictionary,
  findLexemesForWord,
  getLexeme,
  searchByLexemes,
  type Dictionary,
} from '../../src/tanakh/search/search.ts';
import { DICTIONARY_FILES, type DictionaryFiles } from '../../src/tanakh/search/data.ts';
import type { Book, TanakhLayout, TorahData } from '../../src/types.ts';
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
import { HEBREW, LATIN } from './fonts.ts';
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
const FONTS = { hebrew: HEBREW, latin: LATIN };

const SECTION_NAMES = {
  torah: { he: 'תורה', en: 'Five Books' },
  neviim: { he: 'נביאים', en: 'Prophets' },
  ketuvim: { he: 'כתובים', en: 'Writings' },
} as const;

export function loadStructure(): TorahData {
  return JSON.parse(readFileSync(`public/data/${STRUCTURE_FILE}`, 'utf8'));
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
      maxY: -Infinity,
    };
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    b.maxY = Math.max(b.maxY, v.y + v.size);
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
    fonts: FONTS,
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

/** The haftarah overlay's data: its mappings file, loaded as the site loads it, and the structure. */
export async function loadHaftarahData(structure: TorahData): Promise<HaftarahData> {
  const { mappings } = await loadNamedFiles<{ mappings: HaftarahData['mappings'] }>({
    mappings: HAFTARAH_FILES.mappings,
  });
  return { mappings, structure };
}

export async function haftarahSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  const derived = deriveHaftarah(await loadHaftarahData(structure), 'ashkenazi');
  const colours = readingColours(derived.items.length);
  const colourOf = (item: HaftarahItem) => colours[derived.items.indexOf(item)];
  // As colorAt in src/overlays/haftarah.ts: a Torah verse shows its portion,
  // any other verse every reading it is part of.
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = v.id;
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

/** Search's dictionary, from its three files loaded as the site loads them. */
export async function loadDictionary(): Promise<Dictionary> {
  return buildDictionary(await loadNamedFiles<DictionaryFiles>(DICTIONARY_FILES));
}

/**
 * The verses naming a person: only the dictionary entries for the written
 * form glossed as the name, so יצחק marks Isaac and never "laugh".
 */
export function nameVerses(dictionary: Dictionary, he: string, gloss: string): Set<string> {
  const ids = (findLexemesForWord(dictionary, he) ?? []).filter(
    (id) => getLexeme(dictionary, id)?.gloss === gloss,
  );
  if (ids.length === 0) throw new Error(`No dictionary entry for ${he} glossed "${gloss}".`);
  return searchByLexemes(dictionary, ids);
}

export async function searchSheet(structure: TorahData, marks: boolean): Promise<SheetInput> {
  const dictionary = await loadDictionary();
  const sets = NAMES.map((n) => nameVerses(dictionary, n.he, n.en));
  const inks = NAME_HUES.map((_, i) => nameInk(i));
  const fillsOf = (v: TanakhLayout, i: number) => {
    const key = v.id;
    const named = inks.filter((_, k) => sets[k].has(key));
    return named.length ? named : [paleTaupe(i)];
  };
  // The names alone: no title, no notes.
  const key: Key = {
    he: '',
    en: '',
    notes: [],
    columns: [
      {
        width: 400,
        groups: [{ rows: NAMES.map((n, k) => ({ swatch: inks[k], he: n.he, en: n.en })) }],
      },
    ],
    // Five names are the print's caption, not a table to look things up in.
    scale: 2,
  };
  return {
    ...sheet(
      printLayout(structure),
      structure,
      fillsOf,
      key,
      'torahmap.org · Text of the Tanakh from Sefaria · Dictionary from the ETCBC BHSA',
      marks,
    ),
    keyUnder: structure.books.filter((b) => b.section === 'ketuvim').at(-1)!.name,
  };
}

/**
 * A verse's first word, without vowels or accents, run on into the next when
 * it has only two letters. A single letter is never a word, so it is skipped.
 */
export function openingLetters(hebrew: string): string {
  const words = hebrew
    .replace(/־/g, ' ') // maqaf
    .replace(/[^א-ת\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return words[0]?.length === 2 ? words.slice(0, 2).join('') : (words[0] ?? '');
}

/** The haftarah print's opening of Genesis, with each verse's opening letters. */
function microtextPatch(haftarah: SheetInput, structure: TorahData): ProofInput['microtext'] {
  const texts: VerseTexts = JSON.parse(readFileSync(`public/data/${TEXTS_FILE}`, 'utf8'));
  const layout = printLayout(structure);
  const start =
    haftarah.verses[
      layout.findIndex((v) => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1)
    ];
  return {
    title: 'Genesis 1–5',
    verses: haftarah.verses,
    words: layout.map((v) => openingLetters(texts[v.book]?.[v.chapter]?.[v.verse]?.he ?? '')),
    // Genesis runs right to left, so its first verse is at the patch's top right.
    centre: { x: start.x + start.side - 120, y: start.y + 45 },
  };
}

/** Patches of the map at print scale, and every colour the prints use. */
export function proofInput(
  haftarah: SheetInput,
  search: SheetInput,
  scale: number,
  structure: TorahData,
): ProofInput {
  const readings = haftarah.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  const names = search.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
  return {
    kind: 'proof',
    palette: PALETTE,
    fonts: FONTS,
    scale,
    patches: [
      { title: 'Haftarah · Isaiah 40–60', verses: haftarah.verses, centre: { x: 1400, y: 880 } },
      { title: 'Five names · Genesis 22–32', verses: search.verses, centre: { x: 3200, y: 220 } },
    ],
    microtext: microtextPatch(haftarah, structure),
    swatches: [
      ['paper', PAPER],
      ['ink', INK],
      ['quiet ink', INK_SOFT],
      ...[0, 1, 2].map((i) => ['unread', walnut(i)]),
      ...[0, 1, 2].map((i) => ['unnamed', paleTaupe(i)]),
      ...names.map((r) => [r.en, r.swatch]),
      ...readings.map((r) => [r.en, r.swatch]),
    ].map(([name, value]) => ({ fill: value, name, value })),
    bandOffset: haftarah.bandOffset,
    growth: haftarah.growth,
  };
}
