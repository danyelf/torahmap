// Scratch: dump verse squares with their haftarah colours (Ashkenazi) as JSON,
// for palette mockups. Usage: node <this file> <out.json>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/$/, '');
const publicDir = join(repo, 'public');
globalThis.fetch = (async (input: string) => {
  const resolved = normalize(join(publicDir, input.split(/[?#]/)[0]));
  if (!existsSync(resolved)) return new Response(null, { status: 404 });
  return new Response(readFileSync(resolved, 'utf8'), { status: 200 });
}) as typeof fetch;

const { computeLayout } = await import(`${repo}/src/layout.ts`);
const { loadReadings, deriveHaftarah } = await import(`${repo}/src/overlays/haftarah/readings.ts`);
const { tanakhKey } = await import(`${repo}/src/types.ts`);

const structure = JSON.parse(readFileSync(join(publicDir, 'data/tanakh-structure.json'), 'utf8'));
await loadReadings();
const derived = deriveHaftarah('ashkenazi');
// Psalms in three columns (1-50, 51-100, 101-150): the layout code makes at most
// two, so the last third goes in as a book of its own and is renamed after.
const PSALMS_THIRD = 101;
const printStructure = {
  books: structure.books.flatMap((b: any) =>
    b.name !== 'Psalms'
      ? [b]
      : [
          { ...b, chapters: b.chapters.slice(0, PSALMS_THIRD - 1) },
          { ...b, name: 'Psalms, third column', chapters: b.chapters.slice(PSALMS_THIRD - 1) },
        ],
  ),
  layout: { ...structure.layout, multiColumnBooks: { Psalms: { splitAtChapter: 50 } } },
};
const layout = computeLayout(printStructure).map((v: any) =>
  v.book === 'Psalms, third column'
    ? { ...v, book: 'Psalms', chapter: v.chapter + PSALMS_THIRD - 1 }
    : v,
);

const bookIndex = new Map(structure.books.map((b: any, i: number) => [b.name, i]));
const verses = layout.map((v: any) => {
  const key = tanakhKey(v.book, v.chapter, v.verse);
  const parsha = derived.torahVerseToParsha.get(key);
  const items = parsha ? [parsha] : (derived.haftarahVerseToItem.get(key) ?? []);
  const idx = items.map((it: any) => derived.items.indexOf(it));
  return [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, idx, bookIndex.get(v.book)];
});
const out = {
  itemCount: derived.items.length,
  items: derived.items.map((it: any) => [
    it.name,
    it.hebrewName,
    it.torah?.book ?? null,
    it.category ?? null,
  ]),
  books: structure.books.map((b: any) => [b.name, b.hebrewName]),
  verses,
};
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(`${verses.length} verses, ${derived.items.length} readings`);
