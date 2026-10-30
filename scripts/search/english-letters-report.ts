/**
 * Which characters outside ASCII does the shipped English use?
 *
 * English whole-word search needs to know which characters are letters, and
 * `ENGLISH_LETTERS` in `packages/search/src/english.ts` lists the ones beyond
 * a–z. This prints every non-ASCII character in the English of each text, with
 * a count and an example, so that list can be checked against the data:
 *
 *     npm run report:english-letters
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(import.meta.dirname, '../../public/data');

function strings(value: unknown, out: string[], skipKey?: string): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out, skipKey);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (k !== skipKey) strings(v, out, skipKey);
}

function read(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sources: Record<string, string[]> = { tanakh: [], talmud: [], euaiact: [] };
strings(read(join(DATA, 'all-texts.json')), sources.tanakh, 'he');
const talmud = join(DATA, 'talmud/english');
for (const file of readdirSync(talmud)) strings(read(join(talmud, file)), sources.talmud);
strings(read(join(DATA, 'euaiact/texts.json')), sources.euaiact);

const found = new Map<string, { count: number; example: string; texts: Set<string> }>();
const nonAscii = /[^\x00-\x7f]/gu;
for (const [text, all] of Object.entries(sources)) {
  for (const s of all) {
    for (const m of s.matchAll(nonAscii)) {
      const ch = m[0];
      const entry = found.get(ch) ?? { count: 0, example: '', texts: new Set() };
      entry.count++;
      entry.texts.add(text);
      if (!entry.example) {
        const at = m.index;
        entry.example = s.slice(Math.max(0, at - 12), at + 12).replace(/\s+/g, ' ');
      }
      found.set(ch, entry);
    }
  }
}

for (const [ch, e] of [...found].sort((a, b) => b[1].count - a[1].count)) {
  const code = 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
  const kind = /\p{L}/u.test(ch) ? 'letter' : 'not a letter';
  console.log(
    `${ch}\t${code}\t${kind}\t${e.count}\t${[...e.texts].join(',')}\t${JSON.stringify(e.example)}`,
  );
}
