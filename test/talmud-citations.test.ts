// @vitest-environment node
// The Tanakh verses the shipped Talmud text cites.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVerseId } from '@torahmap/link/tanakh';
import type { TalmudTractateText } from '@torahmap/talmud/data.ts';
import { TALMUD_CATEGORY } from '@torahmap/talmud/text.ts';
import { STRUCTURE_FILE } from '@torahmap/tanakh/verseTexts.ts';

const DATA = resolve(__dirname, '../public/data');
const read = (path: string) => JSON.parse(readFileSync(join(DATA, path), 'utf8'));

const chapters = new Map<string, number[]>(
  read(STRUCTURE_FILE).books.map((b: { name: string; chapters: number[] }) => [b.name, b.chapters]),
);

const tractates = readdirSync(join(DATA, 'talmud/texts'));

describe("the Talmud's citations of the Tanakh", () => {
  it.each(tractates)('in %s name real verses, at bracketed words of their segment', (file) => {
    const text: TalmudTractateText = read(`talmud/texts/${file}`);
    for (const [ai, segments] of Object.entries(text.citations)) {
      for (const [si, citations] of Object.entries(segments)) {
        const segment = text.amudim[Number(ai)][Number(si)];
        for (const { start, end, verse } of citations) {
          const place = parseVerseId(verse);
          expect(place, verse).not.toBeNull();
          const { book, chapter, verse: v } = place!;
          expect(v, verse).toBeLessThanOrEqual(chapters.get(book)?.[chapter - 1] ?? 0);
          expect(segment.slice(0, start).trimEnd().at(-1), verse).toMatch(/[([{]/);
          expect(segment.slice(start, end).trim()).toBe(segment.slice(start, end));
        }
      }
    }
  });

  it('link to a category the commentary data counts', () => {
    const counts = read('overlays/commentary/counts.json');
    const categories = new Set(
      Object.values(counts).flatMap((book) =>
        Object.values(book as object).flatMap((verses) =>
          Object.values(verses as object).flatMap((v) => Object.keys(v.categories)),
        ),
      ),
    );
    expect(categories).toContain(TALMUD_CATEGORY);
  });
});
