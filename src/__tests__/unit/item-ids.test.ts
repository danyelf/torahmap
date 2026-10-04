import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { indexItems } from '../../items.ts';
import { STRUCTURE_FILE } from '../../verseTexts.ts';
import { parseVerseId } from '@torahmap/link';
import { STORIES } from '@torahmap/stories';
import { namesRegion } from '../../scrollytelling/storyPanel.ts';
import { initBookData } from '../../constants/books.ts';
import { computeLayout } from '../../layout.ts';
import { computeTalmudLayout } from '../../talmud/layout.ts';
import { talmudId } from '../../talmud/layout.ts';
import type { TorahData } from '../../types.ts';
import { talmudFixture } from '../helpers/talmudFixture.ts';

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

  it('has every story name only verses the map holds', () => {
    const squares = indexItems(computeLayout(shipped(STRUCTURE_FILE)));
    const named = STORIES.flatMap(({ id, data }) =>
      data.stops.flatMap((stop) => {
        const camera =
          typeof stop.camera === 'object' && 'kind' in stop.camera && stop.camera.kind === 'verse'
            ? stop.camera.ref
            : undefined;
        return [stop.verse, camera].flatMap((ref) => (ref ? [`${id}/${stop.id}: ${ref}`] : []));
      }),
    );
    expect(named.filter((where) => !squares.find(where.split(': ')[1]))).toEqual([]);
  });

  it('has every story name only places the map holds', () => {
    initBookData(shipped(STRUCTURE_FILE));
    const verses = computeLayout(shipped(STRUCTURE_FILE));
    const named = STORIES.flatMap(({ id, data }) =>
      data.stops.flatMap((stop) =>
        typeof stop.camera === 'object' && 'kind' in stop.camera && stop.camera.kind === 'regions'
          ? stop.camera.names.map((name) => ({ where: `${id}/${stop.id}: ${name}`, name }))
          : [],
      ),
    );
    expect(named.filter(({ name }) => !namesRegion(verses, name)).map((n) => n.where)).toEqual([]);
  });

  it('lays out the Talmud with no two squares sharing an id', () => {
    expect(() =>
      indexItems(computeTalmudLayout(shipped('talmud/structure.json')).items),
    ).not.toThrow();
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
});
