// Scratch: dump verse squares with which of five name searches each matches,
// only the proper-name meaning of each checked. Usage: node <this file> <out.json>
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
const { loadLexiconData, findLexemesForWord, searchByLexemes, getLexeme } = await import(
  `${repo}/src/search.ts`
);
const { tanakhKey } = await import(`${repo}/src/types.ts`);

const TERMS = ['אברהם', 'יצחק', 'יעקב', 'משה', 'דוד'];
await loadLexiconData();
const sets = TERMS.map((t) => {
  const NAMES = ['Abraham', 'Isaac', 'Jacob', 'Moses', 'David'];
  const ids = (findLexemesForWord(t) ?? []).filter((id: number) =>
    NAMES.includes(getLexeme(id)?.gloss ?? ''),
  );
  console.log(t, ids.map((id: number) => getLexeme(id)?.gloss ?? id).join(' | '));
  const verses = searchByLexemes(ids);
  console.log('  verses:', verses.size);
  return verses;
});

const structure = JSON.parse(readFileSync(join(publicDir, 'data/tanakh-structure.json'), 'utf8'));
const verses = computeLayout(structure).map((v: any) => {
  const key = tanakhKey(v.book, v.chapter, v.verse);
  const hits = sets.flatMap((s, i) => (s.has(key) ? [i] : []));
  return [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, hits];
});
writeFileSync(process.argv[2], JSON.stringify({ terms: TERMS, verses }));
