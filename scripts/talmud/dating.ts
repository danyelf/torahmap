#!/usr/bin/env tsx
// Build public/data/talmud/dating.json from the facts sefaria-dating-facts.py reads out of
// Sefaria's database dump:
//
//   uv run scripts/talmud/sefaria-dating-facts.py <dump dir> <facts.json>
//   node scripts/talmud/dating.ts <facts.json>

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatedSegment, Generation, Person, TalmudDating } from '@torahmap/talmud/dating.ts';
import { DATING_FILE } from '@torahmap/talmud/dating.ts';
import { STRUCTURE_FILE, type TalmudStructure } from '@torahmap/talmud/data.ts';
import { talmudId } from '@torahmap/talmud/layout.ts';

/** The edition the map shows, whose character positions the tags use. */
const EDITION = 'William Davidson Edition - Aramaic';

/** A generation, as opposed to the other kinds of period Sefaria codes. */
const GENERATION_CODE = /^(?:[ZTA]\d|TA)$/;

export interface Mention {
  ref: string;
  topic: string;
  language: string | null;
  version: string | null;
  start: number | null;
  end: number | null;
}

export interface Facts {
  mentions: Mention[];
  /** An ambiguous topic's possible people. */
  candidates: Record<string, string[]>;
  topics: Record<string, { en: string | null; he: string | null; generation: string | null }>;
  periods: Record<string, { en: string | null; from: number; to: number }>;
}

const REF = /^(.+) (\d+)([ab]):(\d+)(.*)$/;
const ORDINALS: Record<string, string> = {
  First: '1st',
  Second: '2nd',
  Third: '3rd',
  Fourth: '4th',
  Fifth: '5th',
  Sixth: '6th',
  Seventh: '7th',
  Eighth: '8th',
};

/** "Amoraim - Fourth Generation" is "Amoraim, 4th generation". */
function generationName(sefariaName: string): string {
  const [group, rest = ''] = sefariaName.split(' - ');
  const words = rest.replace(/^\w+/, (w) => ORDINALS[w] ?? w.toLowerCase());
  return `${group}, ${words.replace('Generation', 'generation')}`;
}

export function datingFrom(facts: Facts, structure: TalmudStructure): TalmudDating {
  const { periods, topics, candidates } = facts;

  /** The latest generation a code names, "A2/A3" being A3; null for a code that is none. */
  const latestOf = (code: string | null | undefined): string | null => {
    const parts = (code ?? '').split('/').filter((c) => GENERATION_CODE.test(c) && periods[c]);
    return parts.sort((a, b) => periods[b].from - periods[a].from)[0] ?? null;
  };

  const isAmbiguous = (slug: string) => slug.endsWith('(ambiguous)');
  const generationOf = (slug: string): string | null =>
    isAmbiguous(slug)
      ? ((candidates[slug] ?? [])
          .map((c) => latestOf(topics[c]?.generation))
          .filter((c): c is string => c !== null)
          .sort((a, b) => periods[b].from - periods[a].from)[0] ?? null)
      : latestOf(topics[slug]?.generation);

  const tractates = new Map(structure.tractates.map((t) => [t.name, t]));
  const byId = new Map<string, Mention[]>();
  for (const m of facts.mentions) {
    if (m.language !== 'he' || m.version !== EDITION) continue;
    if (m.start === null || m.end === null) throw new Error(`${m.ref} has a tag with no position`);
    const match = REF.exec(m.ref);
    if (!match) continue;
    const [, name, daf, amud, segment, rest] = match;
    const tractate = tractates.get(name);
    if (!tractate) continue;
    if (rest) throw new Error(`${m.ref} is a range; mentions must name one segment`);
    const place = tractate.amudim.find((a) => a.daf === Number(daf) && a.amud === amud);
    if (!place || Number(segment) < 1 || Number(segment) > place.segmentCount) {
      throw new Error(`${m.ref} is not a segment of the map`);
    }
    const id = talmudId({
      tractate: name,
      daf: Number(daf),
      amud: amud as 'a' | 'b',
      segment: Number(segment),
    });
    byId.set(id, [...(byId.get(id) ?? []), m]);
  }

  /** Each segment: its latest generation code, whether that is uncertain, and the topics to list. */
  const found = new Map<string, { code: string; uncertain: boolean; slugs: string[] }>();
  for (const [id, mentions] of byId) {
    const dated = mentions.filter((m) => !isAmbiguous(m.topic) && generationOf(m.topic));
    const uncertain = dated.length === 0;
    const pool = uncertain
      ? mentions.filter((m) => isAmbiguous(m.topic) && generationOf(m.topic))
      : dated;
    if (pool.length === 0) continue;
    const code = pool
      .map((m) => generationOf(m.topic)!)
      .sort((a, b) => periods[b].from - periods[a].from)[0];
    // A title tagged as its own person inside a fuller name stays out of the list.
    const inside = (m: Mention) =>
      pool.some(
        (o) =>
          o !== m &&
          o.topic !== m.topic &&
          o.start! <= m.start! &&
          m.end! <= o.end! &&
          o.end! - o.start! > m.end! - m.start!,
      );
    const slugs = [
      ...new Set(
        pool
          .filter((m) => !inside(m))
          .sort((a, b) => a.start! - b.start!)
          .map((m) => m.topic),
      ),
    ];
    found.set(id, { code, uncertain, slugs });
  }

  const slugs = [...new Set([...found.values()].flatMap((f) => f.slugs))].sort();

  // A listed rabbi's generation is in the list even when no segment's latest is that one.
  const codes = [
    ...new Set(
      [...found.values()].map((f) => f.code).concat(slugs.map((slug) => generationOf(slug)!)),
    ),
  ].sort((a, b) => periods[a].from - periods[b].from);
  const generations: Generation[] = codes.map((code) => ({
    code,
    name: generationName(periods[code].en ?? code),
    from: periods[code].from,
    to: periods[code].to,
  }));
  const placeOfCode = new Map(codes.map((c, i) => [c, i]));

  const people: Person[] = slugs.map((slug) => ({
    en: topics[slug].en ?? slug,
    he: topics[slug].he ?? '',
    gen: placeOfCode.get(generationOf(slug)!)!,
    ...(isAmbiguous(slug) ? { ambiguous: true as const } : {}),
  }));
  const placeOfSlug = new Map(slugs.map((s, i) => [s, i]));

  const segments: Record<string, DatedSegment> = {};
  for (const tractate of structure.tractates) {
    for (const amud of tractate.amudim) {
      for (let segment = 1; segment <= amud.segmentCount; segment++) {
        const id = talmudId({ tractate: tractate.name, daf: amud.daf, amud: amud.amud, segment });
        const f = found.get(id);
        if (f) {
          segments[id] = [
            placeOfCode.get(f.code)!,
            f.uncertain ? 1 : 0,
            ...f.slugs.map((s) => placeOfSlug.get(s)!),
          ];
        }
      }
    }
  }
  return { generations, people, segments };
}

async function main() {
  const factsPath = process.argv[2];
  if (!factsPath) throw new Error('usage: node scripts/talmud/dating.ts <facts.json>');
  const dataDir = join(import.meta.dirname, '../../public/data');
  const facts = JSON.parse(await readFile(factsPath, 'utf-8')) as Facts;
  const structure = JSON.parse(
    await readFile(join(dataDir, STRUCTURE_FILE), 'utf-8'),
  ) as TalmudStructure;
  const dating = datingFrom(facts, structure);
  await writeFile(join(dataDir, DATING_FILE), JSON.stringify(dating), 'utf-8');

  const uncertain = Object.values(dating.segments).filter((s) => s[1] === 1).length;
  console.log(`${Object.keys(dating.segments).length} segments dated, ${uncertain} uncertain`);
  for (const g of dating.generations) console.log(`  ${g.code} ${g.name} ${g.from} to ${g.to}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('dating failed:', err);
    process.exit(1);
  });
}
