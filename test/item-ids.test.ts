import { indexItems } from '@torahmap/engine';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { STRUCTURE_FILE } from '@torahmap/tanakh/verseTexts.ts';
import { parseVerseId } from '@torahmap/link/tanakh';
import { STORIES } from '@torahmap/stories/tanakh';
import { namesPlace } from '@torahmap/tanakh/stories.ts';
import { initBookData } from '@torahmap/tanakh/books.ts';
import { computeLayout } from '@torahmap/tanakh/layout.ts';
import { computeTalmudLayout } from '@torahmap/talmud/layout.ts';
import { parseTalmudId, talmudId } from '@torahmap/talmud/layout.ts';
import {
  STRUCTURE_FILE as TALMUD_STRUCTURE_FILE,
  hadranLines,
  textsFile,
  type TalmudStructure,
  type TalmudTractateText,
} from '@torahmap/talmud/data.ts';
import type { TorahData } from '@torahmap/tanakh/types.ts';
import { talmudFixture } from '../apps/talmud/test/helpers/talmudFixture.ts';

const torahData: TorahData = {
  books: [
    { name: 'Genesis', hebrewName: 'בראשית', section: 'torah', chapters: [3, 2] },
    { name: 'I Samuel', hebrewName: 'שמואל א', section: 'neviim', chapters: [2] },
    { name: 'Song of Songs', hebrewName: 'שיר השירים', section: 'ketuvim', chapters: [2] },
  ],
  layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
};

// Mistakes in the shipped data and stories are caught here, before they reach a
// reader: the map refuses to start if two squares share an id, and a story stop
// naming a verse the map lacks lands nowhere.
describe('the shipped data', () => {
  const shipped = (path: string) => JSON.parse(readFileSync(`public/data/${path}`, 'utf8'));

  it('lays out the Tanakh with no two squares sharing an id', () => {
    expect(() => indexItems(computeLayout(shipped(STRUCTURE_FILE)))).not.toThrow();
  });

  it('keys the search index by verses the map holds', () => {
    const squares = indexItems(computeLayout(shipped(STRUCTURE_FILE)));
    const morphology = shipped('search/verse-morphology.json');
    const keys = [
      ...Object.keys(shipped('search/verse-lexemes.json')),
      ...Object.keys(morphology.verses),
      ...Object.keys(morphology.realigned),
    ];
    expect(keys.filter((key) => !squares.find(key))).toEqual([]);
  });

  it('has every story pin only verses the map holds', () => {
    const squares = indexItems(computeLayout(shipped(STRUCTURE_FILE)));
    const pinned = STORIES.flatMap(({ id, data }) =>
      data.stops.flatMap((stop) => (stop.pin ? [`${id}/${stop.id}: ${stop.pin}`] : [])),
    );
    expect(pinned.filter((where) => !squares.find(where.split(': ')[1]))).toEqual([]);
  });

  it('has every story name only places the map holds', () => {
    initBookData(shipped(STRUCTURE_FILE));
    const verses = computeLayout(shipped(STRUCTURE_FILE));
    const squares = indexItems(verses);
    const named = STORIES.flatMap(({ id, data }) =>
      data.stops.flatMap((stop) =>
        typeof stop.camera === 'object' && 'kind' in stop.camera && stop.camera.kind === 'places'
          ? stop.camera.names.map((name) => ({ where: `${id}/${stop.id}: ${name}`, name }))
          : [],
      ),
    );
    expect(
      named.filter(({ name }) => !namesPlace(verses, squares, name)).map((n) => n.where),
    ).toEqual([]);
  });

  it('lays out the Talmud with no two squares sharing an id', () => {
    expect(() =>
      indexItems(computeTalmudLayout(shipped('talmud/structure.json')).items),
    ).not.toThrow();
  });

  it('closes every perek with its hadran line, and has none elsewhere', () => {
    const structure: TalmudStructure = shipped(TALMUD_STRUCTURE_FILE);
    const misplaced = structure.tractates.flatMap((t) => {
      const text: TalmudTractateText = shipped(textsFile(t.name));
      const place = (daf: number, amud: string, segment: number) => `${daf}${amud}:${segment}`;
      const hadrans = new Set(hadranLines(t).map((h) => place(h.daf, h.amud, h.segment)));
      return t.amudim.flatMap((amud, ai) =>
        text.amudim[ai].flatMap((segment, si) => {
          const at = place(amud.daf, amud.amud, si + 1);
          return segment.startsWith('הדרן') === hadrans.has(at) ? [] : [`${t.name} ${at}`];
        }),
      );
    });
    expect(misplaced).toEqual([]);
  });
});

describe('square ids', () => {
  it('names each Tanakh square by its verse id', () => {
    for (const v of computeLayout(torahData)) {
      expect(parseVerseId(v.id)).toEqual({ book: v.book, chapter: v.chapter, verse: v.verse });
    }
  });

  it('gives every Tanakh square a different id', () => {
    const ids = computeLayout(torahData).map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes a Talmud segment as tractate, page and segment, with dots for spaces', () => {
    expect(talmudId({ tractate: 'Bava Kamma', daf: 2, amud: 'a', segment: 1 })).toBe(
      'Bava.Kamma.2a.1',
    );
  });

  it('gives every Talmud square a different id, matching its segment', () => {
    const { items } = computeTalmudLayout(talmudFixture);
    for (const s of items) expect(s.id).toBe(talmudId(s));
    expect(new Set(items.map((s) => s.id)).size).toBe(items.length);
  });

  it('reads back every Talmud id as its segment', () => {
    for (const s of computeTalmudLayout(talmudFixture).items) {
      const { tractate, daf, amud, segment } = s;
      expect(parseTalmudId(s.id)).toEqual({ tractate, daf, amud, segment });
    }
  });

  it('reads no segment from an id no segment writes', () => {
    for (const id of ['Genesis.12.1', 'Bava.Kamma.02a.1', 'Berakhot.2c.1', 'Berakhot.2a'])
      expect(parseTalmudId(id)).toBeNull();
  });
});
