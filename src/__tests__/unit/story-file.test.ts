// Every shipped story reads the way it was written. The parser drops what it
// cannot read without failing, so a slip such as `zoom 0.5` quietly changes
// the view instead of stopping the commit.
import { beforeAll, describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseStoryMarkdown,
  STOP_COMMENT_RE,
  STORY_HEADER_KEYS,
  STORY_MARKDOWN,
} from '@torahmap/stories';
import { registerAllOverlays, getOverlay } from '../../overlays/index';
import { writeLink, parseVerseFromUrl } from '@torahmap/link';
import { parseUrlState } from '../../urlState';
import { isSearching, searchTool } from '../../overlays/search/index';
import { settingsFromLink } from '../../overlays/settings';
import { haftarahOverlay } from '../../overlays/haftarah';
import {
  deriveHaftarah,
  HAFTARAH_FILES,
  type HaftarahData,
} from '../../overlays/haftarah/readings';
import { filesFor, loadFiles } from '../../dataFiles';
import { setLink } from '../helpers/setLink';

const dataDir = path.join(process.cwd(), 'public', 'data');

registerAllOverlays();

let readings: HaftarahData;
beforeAll(async () => {
  readings = filesFor<HaftarahData>(
    HAFTARAH_FILES,
    await loadFiles(Object.values(HAFTARAH_FILES)),
  )!;
});

/**
 * Stops whose haftarah reading, once read the way the app does, is no
 * reading's name. The app lights nothing for such a stop rather than failing.
 */
function unknownReadings(stops: ReturnType<typeof parseStoryMarkdown>['stops']): string[] {
  return stops
    .filter((s) => s.overlay === 'haftarah' && s.overlayParams?.reading)
    .filter((s) => {
      const { custom, reading } = settingsFromLink(haftarahOverlay, s.overlayParams!);
      return !reading || !deriveHaftarah(readings, custom).itemByName.has(reading);
    })
    .map((s) => `${s.id}: ${s.overlayParams!.reading}`);
}

describe.each(Object.entries(STORY_MARKDOWN))('%s', (id, markdown) => {
  const story = parseStoryMarkdown(markdown);
  const { stops } = story;
  const comments = [...markdown.matchAll(STOP_COMMENT_RE)];
  // The header as written, read without the parser, which drops what it does not know.
  const header = Object.fromEntries(
    (markdown.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '')
      .split('\n')
      .map((line) => line.match(/^([^:]+):\s*(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(([, key, value]) => [key.trim(), value.trim()]),
  );

  it('has an id a link can carry', () => {
    setLink(writeLink({ story: id, overlayParams: {} }));
    expect(parseUrlState().story).toBe(id);
  });

  it('has a title and a description', () => {
    expect(story.title).toBeTruthy();
    expect(story.description).toBeTruthy();
  });

  it('writes only header keys the parser reads', () => {
    const known: readonly string[] = STORY_HEADER_KEYS;
    expect(Object.keys(header).filter((key) => !known.includes(key))).toEqual([]);
  });

  it('writes draft, if it has one, as true or false', () => {
    if ('draft' in header) expect(['true', 'false']).toContain(header.draft);
  });

  it('writes its order, if it has one, as a number', () => {
    if ('order' in header) expect(story.order).toBe(Number(header.order));
  });

  it('writes every setting as key: value', () => {
    const unread = comments.flatMap(([, id, settings]) =>
      (settings === undefined ? ([] as string[]) : settings.split('|'))
        .map((part: string) => part.trim())
        .filter((part: string) => !/^[^:]+:\s*\S/.test(part))
        .map((part: string) => `${id.trim()}: "${part}"`),
    );
    expect(unread).toEqual([]);
  });

  it('gives every stop its own id', () => {
    const ids = stops.map((s) => s.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('names only verses that exist', () => {
    const texts = JSON.parse(fs.readFileSync(path.join(dataDir, 'all-texts.json'), 'utf-8'));
    const exists = (ref: string): boolean => {
      const v = parseVerseFromUrl(ref);
      return !!v && !!texts[v.book]?.[String(v.chapter)]?.[String(v.verse)];
    };
    const missing = stops.flatMap((s) => {
      const refs = [s.verse, typeof s.camera === 'object' && 'ref' in s.camera && s.camera.ref];
      return refs.filter((r): r is string => !!r && !exists(r)).map((r) => `${s.id}: ${r}`);
    });
    expect(missing).toEqual([]);
  });

  it('names only regions that exist', () => {
    // A camera the parser does not otherwise read is taken as region names.
    const structure = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'tanakh-structure.json'), 'utf-8'),
    );
    const regions = new Set([
      'everything',
      'Torah',
      'Neviim',
      'Ketuvim',
      ...structure.books.map((b: { name: string }) => b.name.replace(/ /g, '.')),
    ]);
    const unknown = stops.flatMap((s) =>
      typeof s.camera === 'object' && 'names' in s.camera
        ? s.camera.names.filter((n) => !regions.has(n)).map((n) => `${s.id}: ${n}`)
        : [],
    );
    expect(unknown).toEqual([]);
  });

  it('uses only overlays that exist, with settings they take', () => {
    const wrong = stops.flatMap((s) => {
      const keys = Object.keys(s.overlayParams ?? {});
      if (!s.overlay) return keys.length ? [`${s.id}: ${keys.join(', ')} without an overlay`] : [];
      const overlay = getOverlay(s.overlay);
      if (!overlay) return [`${s.id}: no overlay "${s.overlay}"`];
      const known = new Set((overlay.urlParams ?? []).map((p) => p.key));
      return keys.filter((k) => !known.has(k)).map((k) => `${s.id}: ${s.overlay} has no "${k}"`);
    });
    expect(wrong).toEqual([]);
  });

  it('names only commentary categories the data has', () => {
    // A category is checked for its spelling when read, not for existing.
    const counts = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'overlays', 'commentary', 'counts.json'), 'utf-8'),
    );
    const categories = new Set(['total']);
    for (const chapters of Object.values<Record<string, Record<string, { categories?: object }>>>(
      counts,
    ))
      for (const verses of Object.values(chapters))
        for (const verse of Object.values(verses))
          for (const c of Object.keys(verse.categories ?? {})) categories.add(c);

    const unknown = stops
      .filter((s) => s.overlay === 'commentary' && s.overlayParams?.category)
      .filter((s) => !categories.has(s.overlayParams!.category))
      .map((s) => `${s.id}: ${s.overlayParams!.category}`);
    expect(unknown).toEqual([]);
  });

  it('names only haftarah readings the data has', () => {
    expect(unknownReadings(stops)).toEqual([]);
  });

  it('searches, where a stop searches, for words long enough to search on', () => {
    const idle = stops
      .filter((s) => s.searchParams && !isSearching(settingsFromLink(searchTool, s.searchParams)))
      .map((s) => s.id);
    expect(idle).toEqual([]);
  });
});
