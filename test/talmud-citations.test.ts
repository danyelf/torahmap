// @vitest-environment node
// The Tanakh verses the shipped Talmud text cites.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVerseId } from '@torahmap/link/tanakh';
import type { TalmudTractateText } from '@torahmap/talmud/data.ts';
import { englishText } from '@torahmap/talmud/english.ts';
import { TALMUD_CATEGORY } from '@torahmap/talmud/text.ts';
import { STRUCTURE_FILE } from '@torahmap/tanakh/verseTexts.ts';

const DATA = resolve(__dirname, '../public/data');
const read = (path: string) => JSON.parse(readFileSync(join(DATA, path), 'utf8'));

const chapters = new Map<string, number[]>(
  read(STRUCTURE_FILE).books.map((b: { name: string; chapters: number[] }) => [b.name, b.chapters]),
);

const tractates = readdirSync(join(DATA, 'talmud/texts'));

describe("the Talmud's citations of the Tanakh", () => {
  it.each(tractates)(
    'in %s name real verses, each on words of its segment or shown as its reference',
    (file) => {
      const text: TalmudTractateText = read(`talmud/texts/${file}`);
      for (const [ai, segments] of Object.entries(text.citations)) {
        for (const [si, citations] of Object.entries(segments)) {
          const segment = text.amudim[Number(ai)][Number(si)];
          let previous = 0;
          for (const { start, end, verse, reference } of citations) {
            // In order, and no two links over the same words.
            expect(start, verse).toBeGreaterThanOrEqual(previous);
            previous = end;
            const place = parseVerseId(verse);
            expect(place, verse).not.toBeNull();
            const { book, chapter, verse: v } = place!;
            expect(v, verse).toBeLessThanOrEqual(chapters.get(book)?.[chapter - 1] ?? 0);
            expect(end, verse).toBeLessThanOrEqual(segment.length);
            if (reference === undefined) {
              expect(segment.slice(start, end).trim(), verse).toBe(segment.slice(start, end));
              expect(end, verse).toBeGreaterThan(start);
            } else {
              expect(end, verse).toBe(start);
              expect(reference, verse).toMatch(/^\(.+\)$/);
            }
          }
        }
      }
    },
  );

  it.each(tractates)(
    "in %s's English name real verses, each on a parenthesised reference of its segment",
    (file) => {
      const text: TalmudTractateText = read(`talmud/texts/${file}`);
      const english: string[][] = read(`talmud/english/${file}`);
      for (const [ai, segments] of Object.entries(text.englishCitations)) {
        for (const [si, citations] of Object.entries(segments)) {
          const { text: plain } = englishText(english[Number(ai)][Number(si)]);
          let previous = 0;
          for (const { start, end, verse } of citations) {
            expect(start, verse).toBeGreaterThanOrEqual(previous);
            previous = end;
            const place = parseVerseId(verse);
            expect(place, verse).not.toBeNull();
            const { book, chapter, verse: v } = place!;
            expect(v, verse).toBeLessThanOrEqual(chapters.get(book)?.[chapter - 1] ?? 0);
            const reference = plain.slice(start, end);
            expect(reference, verse).toMatch(/^\(.*\)$/s);
            expect(reference, verse).toContain(`${chapter}:${v}`);
          }
        }
      }
    },
  );

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
