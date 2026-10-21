import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { GoTo } from '@torahmap/shell/app/text.ts';
import { STRUCTURE_FILE } from '@torahmap/tanakh/verseTexts.ts';
import { computeLayout } from '@torahmap/tanakh/layout.ts';
import { EXAMPLES as TANAKH_EXAMPLES, verseReader } from '@torahmap/tanakh/references.ts';
import { STRUCTURE_FILE as TALMUD_STRUCTURE } from '@torahmap/talmud/data.ts';
import { computeTalmudLayout } from '@torahmap/talmud/layout.ts';
import { EXAMPLES as TALMUD_EXAMPLES, segmentReader } from '@torahmap/talmud/references.ts';
import { STRUCTURE_FILE as ACT_STRUCTURE } from '@torahmap/euaiact/data.ts';
import { computeActLayout } from '@torahmap/euaiact/layout.ts';
import { EXAMPLES as ACT_EXAMPLES, provisionReader } from '@torahmap/euaiact/references.ts';

const shipped = (path: string) => JSON.parse(readFileSync(`public/data/${path}`, 'utf8'));

/** The examples that read to no place, or to a square the map lacks. */
function unread(
  examples: readonly string[],
  reader: Omit<GoTo, 'examples'>,
  ids: string[],
): string[] {
  const held = new Set(ids);
  return examples.filter((typed) => {
    const found = reader.read(typed);
    return !found || found.ids.length === 0 || !found.ids.every((id) => held.has(id));
  });
}

describe('the Go to examples', () => {
  it('each read to a place on the Tanakh', () => {
    const structure = shipped(STRUCTURE_FILE);
    const ids = computeLayout(structure).map((v) => v.id);
    expect(unread(TANAKH_EXAMPLES, verseReader(structure.books), ids)).toEqual([]);
  });

  it('each read to a place on the Talmud', () => {
    const structure = shipped(TALMUD_STRUCTURE);
    const ids = computeTalmudLayout(structure).items.map((s) => s.id);
    expect(unread(TALMUD_EXAMPLES, segmentReader(structure.tractates), ids)).toEqual([]);
  });

  it('each read to a place in the Act', () => {
    const ids = computeActLayout(shipped(ACT_STRUCTURE)).items.map((item) => item.id);
    expect(unread(ACT_EXAMPLES, provisionReader(ids), ids)).toEqual([]);
  });
});
