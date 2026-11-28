#!/usr/bin/env tsx
/**
 * Draws tokens whose form has several Jastrow headwords and a hand-picked one
 * (`adjust_most_common_talmud_words`), with the sentence around each, so a
 * reader can mark whether the pick fits there. Output derives from Sefaria's
 * table: write it outside the repository.
 *
 * Usage:
 *   npx tsx scripts/talmud/choice-sample.ts <dump folder> <output.json> [count] [seed]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeHebrewForSearch } from '@torahmap/hebrew';
import { documents } from './bson.ts';

const [DUMP, OUT, COUNT = '100', SEED = '1'] = process.argv.slice(2);
const JASTROW = 'Jastrow Dictionary';
const CHOSEN = 'adjust_most_common_talmud_words';
const WORD = /[א-ת]+(?:״[א-ת]+)*׳?/g;
const fold = (s: string) => normalizeHebrewForSearch(s).trim();

const forms = new Map<string, { heads: Set<string>; chosen: Set<string> }>();
for (const doc of documents(join(DUMP, 'word_form.bson'))) {
  const lookups = ((doc.lookups ?? []) as { headword?: string; parent_lexicon?: string }[]).filter(
    (l) => l.parent_lexicon === JASTROW && l.headword,
  );
  for (const key of new Set([doc.form, doc.c_form].filter((f): f is string => !!f).map(fold))) {
    const e = forms.get(key) ?? { heads: new Set(), chosen: new Set() };
    forms.set(key, e);
    for (const { headword } of lookups) {
      e.heads.add(headword!);
      if (doc.generated_by === CHOSEN) e.chosen.add(headword!);
    }
  }
}

const gloss = new Map<string, string>();
for (const doc of documents(join(DUMP, 'lexicon_entry.bson'))) {
  if (doc.parent_lexicon !== JASTROW) continue;
  const senses = (doc.content as { senses?: { definition?: string }[] })?.senses ?? [];
  const text = (senses[0]?.definition ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  gloss.set(doc.headword as string, text.slice(0, 110));
}

interface Pick {
  ref: string;
  written: string;
  context: string;
  chosen: Record<string, string>;
  others: Record<string, string>;
}
const structure = JSON.parse(readFileSync('public/data/talmud/structure.json', 'utf8'));
const text: Record<string, string[][]> = JSON.parse(
  readFileSync('public/data/talmud/search.json', 'utf8'),
);
const pool: Pick[] = [];
for (const { name, amudim } of structure.tractates as {
  name: string;
  amudim: { daf: number; amud: string }[];
}[]) {
  for (const [i, a] of amudim.entries()) {
    for (const [s, segment] of text[name][i].entries()) {
      const words = [...segment.matchAll(WORD)].map((m) => m[0]);
      for (const [w, written] of words.entries()) {
        const e = forms.get(fold(written));
        if (!e || e.chosen.size === 0 || e.heads.size < 2 || fold(written).length < 2) continue;
        const g = (hs: string[]) => Object.fromEntries(hs.map((h) => [h, gloss.get(h) ?? '']));
        pool.push({
          ref: `${name} ${a.daf}${a.amud}:${s + 1}`,
          written,
          context: words.slice(Math.max(0, w - 7), w + 6).join(' '),
          chosen: g([...e.chosen]),
          others: g([...e.heads].filter((h) => !e.chosen.has(h)).slice(0, 8)),
        });
      }
    }
  }
}

let state = Number(SEED) >>> 0;
const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
const picks: Pick[] = [];
for (let n = 0; n < Number(COUNT); n++)
  picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
writeFileSync(
  OUT,
  JSON.stringify(
    picks.map((p, id) => ({ id, ...p })),
    null,
    1,
  ),
);
console.log(`pool ${pool.length + picks.length} tokens; wrote ${picks.length}`);
