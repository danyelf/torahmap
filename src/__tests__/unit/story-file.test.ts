// The shipped story reads the way it was written. The parser drops what it
// cannot read without failing, so a slip such as `zoom 0.5` quietly changes
// the view instead of stopping the commit.
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseStoryMarkdown } from '../../scrollytelling/storyParser';
import { registerAllOverlays, getOverlay } from '../../overlays/index';
import { parseVerseFromUrl } from '../../urlState';

const dataDir = path.join(process.cwd(), 'public', 'data');
const markdown = fs.readFileSync(path.join(dataDir, 'story.md'), 'utf-8');
const { stops } = parseStoryMarkdown(markdown);
const comments = [...markdown.matchAll(/<!--\s*stop:\s*([^|>]+?)(?:\s*\|(.+?))?\s*-->/g)];

registerAllOverlays();

describe('story.md', () => {
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

  it('writes every camera in a form the parser reads', () => {
    // An unreadable camera falls back to 'initial', the same as one left out.
    const fellBack = comments
      .filter(([, , settings = '']) => /camera:\s*(?!initial)\S/.test(settings))
      .map(([, id]) => id.trim())
      .filter((id) => stops.find((s) => s.id === id)?.camera === 'initial');
    expect(fellBack).toEqual([]);
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
