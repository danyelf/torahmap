// Every shipped story reads the way it was written. The parser drops what it
// cannot read without failing, so a slip such as `zoom 0.5` quietly changes
// the view instead of stopping the commit.
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseStoryMarkdown } from '../../scrollytelling/storyParser';
import { registerAllOverlays, getOverlay } from '../../overlays/index';
import { parseVerseFromUrl } from '../../urlState';

const dataDir = path.join(process.cwd(), 'public', 'data');
const storiesDir = path.join(dataDir, 'stories');
const index: { id: string }[] = JSON.parse(
  fs.readFileSync(path.join(storiesDir, 'index.json'), 'utf-8'),
);
const readMarkdown = (id: string): string =>
  fs.readFileSync(path.join(storiesDir, `${id}.md`), 'utf-8');

registerAllOverlays();

describe('stories/index.json', () => {
  it('lists every story in the directory, and only those', () => {
    const files = fs
      .readdirSync(storiesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    expect(index.map((s) => s.id).sort()).toEqual(files);
  });

  it('gives every story a title and a description', () => {
    const missing = index
      .filter(({ id }) => {
        const story = parseStoryMarkdown(readMarkdown(id));
        return !story.title || !story.description;
      })
      .map(({ id }) => id);
    expect(missing).toEqual([]);
  });
});

describe.each(index.map((s) => s.id))('%s.md', (id) => {
  const markdown = readMarkdown(id);
  const { stops } = parseStoryMarkdown(markdown);
  const comments = [...markdown.matchAll(/<!--\s*stop:\s*([^|>]+?)(?:\s*\|(.+?))?\s*-->/g)];

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
});
