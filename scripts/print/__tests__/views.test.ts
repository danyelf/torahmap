import { beforeAll, describe, expect, it } from 'vitest';
import { deriveHaftarah } from '../../../src/overlays/haftarah/readings.ts';
import type { Dictionary } from '../../../src/search.ts';
import type { SheetInput } from '../types.ts';
import {
  haftarahKey,
  haftarahSheet,
  loadDictionary,
  loadHaftarahData,
  loadStructure,
  openingLetters,
  nameVerses,
  searchSheet,
} from '../views.ts';

const structure = loadStructure();

describe('openingLetters', () => {
  it('drops vowels and accents, and splits at a maqaf', () => {
    expect(openingLetters('וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר')).toBe('ויהי');
  });

  it('skips a single letter, which is never a word', () => {
    expect(openingLetters('ו אֱלֹהִ֑ים')).toBe('אלהים');
  });

  it('runs a two-letter word on into the next', () => {
    expect(openingLetters('כִּי־ט֑וֹב וַיֹּ֥אמֶר')).toBe('כיטוב');
  });
});

describe('haftarahSheet', () => {
  let sheet: SheetInput;
  beforeAll(async () => {
    sheet = await haftarahSheet(structure, false);
  });

  it('draws every verse, split where a verse is in more than one reading', () => {
    const total = structure.books.flatMap((b) => b.chapters).reduce((a, b) => a + b, 0);
    expect(sheet.verses).toHaveLength(total);
    expect(sheet.verses.some((v) => v.fills.length > 1)).toBe(true);
  });

  it('lists every reading in the key exactly once, in the colour it has on the map', async () => {
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    const derived = deriveHaftarah(await loadHaftarahData(structure), 'ashkenazi');
    expect(rows.map((r) => r.en).sort()).toEqual(derived.items.map((i) => i.name).sort());
    const onMap = new Set(sheet.verses.flatMap((v) => v.fills));
    for (const row of rows) expect(onMap.has(row.swatch)).toBe(true);
  });

  it('refuses a kind of occasion the key has no column for', async () => {
    const derived = deriveHaftarah(await loadHaftarahData(structure), 'ashkenazi');
    const stray = { ...derived.items.at(-1)!, name: 'Stray', category: 'unheard-of' };
    const items = [...derived.items, stray];
    expect(() =>
      haftarahKey(
        { ...derived, items } as typeof derived,
        items.map(() => '#000000'),
        structure.books.filter((b) => b.section === 'torah'),
      ),
    ).toThrow(/unheard-of/);
  });
});

describe('searchSheet', () => {
  let dictionary: Dictionary;
  beforeAll(async () => {
    dictionary = await loadDictionary();
  });

  it('marks only the proper names', () => {
    const isaac = nameVerses(dictionary, 'יצחק', 'Isaac');
    expect(isaac.size).toBeGreaterThan(0);
    // Genesis 21:6, "everyone who hears will laugh with me", has the verb and not the name.
    expect(isaac.has('Genesis:21:6')).toBe(false);
  });

  it('refuses a name with no dictionary entry', () => {
    expect(() => nameVerses(dictionary, 'אברהם', 'Abram the Unknown')).toThrow(/Abram the Unknown/);
  });

  it('gives each name one colour and a key row', async () => {
    const sheet = await searchSheet(structure, false);
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    expect(rows.map((r) => r.en)).toEqual(['Abraham', 'Isaac', 'Jacob', 'Moses', 'David']);
    expect(new Set(rows.map((r) => r.swatch)).size).toBe(5);
  });

  it('keys the names alone, under the last book of the Writings', async () => {
    const sheet = await searchSheet(structure, false);
    expect(sheet.key.notes).toEqual([]);
    expect(sheet.key.en).toBe('');
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    expect(rows.every((r) => r.note === undefined)).toBe(true);
    const lastWriting = structure.books.filter((b) => b.section === 'ketuvim').at(-1)!;
    expect(sheet.keyUnder).toBe(lastWriting.name);
  });
});
