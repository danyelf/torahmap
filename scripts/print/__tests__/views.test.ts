import { beforeAll, describe, expect, it } from 'vitest';
import { deriveHaftarah, loadReadings } from '../../../src/overlays/haftarah/readings.ts';
import { loadLexiconData } from '../../../src/search.ts';
import type { SheetInput } from '../types.ts';
import { haftarahKey, haftarahSheet, loadStructure, nameVerses, searchSheet } from '../views.ts';

const structure = loadStructure();

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

  it('lists every reading in the key exactly once, in the colour it has on the map', () => {
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    const derived = deriveHaftarah('ashkenazi');
    expect(rows.map((r) => r.en).sort()).toEqual(derived.items.map((i) => i.name).sort());
    const onMap = new Set(sheet.verses.flatMap((v) => v.fills));
    for (const row of rows) expect(onMap.has(row.swatch)).toBe(true);
  });

  it('refuses a kind of occasion the key has no column for', async () => {
    await loadReadings();
    const derived = deriveHaftarah('ashkenazi');
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
  beforeAll(async () => {
    await loadLexiconData();
  });

  it('marks only the proper names', () => {
    const isaac = nameVerses('יצחק', 'Isaac');
    expect(isaac.size).toBeGreaterThan(0);
    // Genesis 21:6, "everyone who hears will laugh with me", has the verb and not the name.
    expect(isaac.has('Genesis:21:6')).toBe(false);
  });

  it('refuses a name with no dictionary entry', () => {
    expect(() => nameVerses('אברהם', 'Abram the Unknown')).toThrow(/Abram the Unknown/);
  });

  it('gives each name one colour and a key row', async () => {
    const sheet = await searchSheet(structure, false);
    const rows = sheet.key.columns.flatMap((c) => c.groups.flatMap((g) => g.rows));
    expect(rows.map((r) => r.en)).toEqual(['Abraham', 'Isaac', 'Jacob', 'Moses', 'David']);
    expect(new Set(rows.map((r) => r.swatch)).size).toBe(5);
  });
});
