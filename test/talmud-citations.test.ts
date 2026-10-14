// @vitest-environment node
// The Tanakh verses the shipped Talmud text cites, and the links its popup makes of them.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLink } from '@torahmap/link';
import { parseVerseId } from '@torahmap/link/tanakh';
import { LINK_KEYS } from '@torahmap/overlay-catalog';
import type { TalmudTractateText } from '@torahmap/talmud/data.ts';
import { tanakhLink } from '@torahmap/talmud/tanakhLink.ts';

const DATA = resolve(__dirname, '../public/data');
const read = (path: string) => JSON.parse(readFileSync(join(DATA, path), 'utf8'));

const chapters = new Map<string, number[]>(
  read('tanakh-structure.json').books.map((b: { name: string; chapters: number[] }) => [
    b.name,
    b.chapters,
  ]),
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

  it("link to the Tanakh's map on the verse, with the commentary overlay on the Talmud", () => {
    // Every category the commentary data counts, on any verse.
    const categories = new Set(
      Object.values(read('overlays/commentary/counts.json')).flatMap((book) =>
        Object.values(book as object).flatMap((verses) =>
          Object.values(verses as object).flatMap((v) => Object.keys(v.categories)),
        ),
      ),
    );
    const text: TalmudTractateText = read('talmud/texts/Berakhot.json');
    const verses = Object.values(text.citations)
      .flatMap((segments) => Object.values(segments).flat())
      .map((c) => c.verse);
    expect(verses.length).toBeGreaterThan(0);
    for (const verse of verses) {
      const href = tanakhLink(verse);
      expect(href.startsWith('/?')).toBe(true);
      const link = readLink(href.slice(1), LINK_KEYS);
      expect(link).toMatchObject({ square: verse, overlay: 'commentary' });
      expect(categories).toContain(link.overlayParams.category);
    }
  });
});
