// The Tanakh verses the English cites: Davidson writes each out beside its quotation, as
// (Deuteronomy 6:7).

import { verseId } from '@torahmap/link/tanakh';
import { englishText } from '@torahmap/talmud/english.ts';
import type { Citation, CitationsByPlace, TalmudTractateEnglish } from '@torahmap/talmud/data.ts';
import { booksByName, hasVerse, type TanakhBook } from './citations.ts';

/** Slips in how the English writes a book, by the lower-case name they stand for. */
const SPELLINGS: Readonly<Record<string, string>> = { number: 'numbers', hoshea: 'hosea' };

/** "see" and "e.g." may open a reference; whatever else does, as "on Job", names no verse. */
const LEAD = String.raw`(?:(?:see|e\.g\.)[,\s]+)*`;

/**
 * Finds the references in a segment's English, and the ones that name a verse their book lacks. A
 * range or a list links to its first verse; a book outside the Tanakh is not found.
 */
export function englishCitationFinder(
  books: readonly TanakhBook[],
): (marked: string) => { citations: Citation[]; unlinked: string[] } {
  const byName = booksByName(books, (book) => book.name.toLowerCase(), SPELLINGS);
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  // Book names are plain words. The English may write the space in "I Kings" as a non-breaking one.
  const spaced = names.map((name) => name.replace(/ /g, String.raw`\s+`));
  const reference = new RegExp(
    String.raw`\(\s*${LEAD}(${spaced.join('|')})[\s:]*(\d+):(\d+)[^()]*\)`,
    'gi',
  );

  return (marked) => {
    const { text } = englishText(marked);
    const citations: Citation[] = [];
    const unlinked: string[] = [];
    for (const match of text.matchAll(reference)) {
      const book = byName.get(match[1].replace(/\s+/g, ' ').toLowerCase())!;
      const [chapter, verse] = [Number(match[2]), Number(match[3])];
      if (!hasVerse(book, chapter, verse)) {
        unlinked.push(`${match[0]}: ${book.name} has no verse ${chapter}:${verse}`);
        continue;
      }
      citations.push({
        start: match.index,
        end: match.index + match[0].length,
        verse: verseId(book.name, chapter, verse),
      });
    }
    return { citations, unlinked };
  };
}

/** The references of a tractate's English, by amud and segment. */
export function englishCitationsByPlace(
  english: TalmudTractateEnglish,
  find: ReturnType<typeof englishCitationFinder>,
): { citations: CitationsByPlace; unlinked: string[] } {
  const citations: CitationsByPlace = {};
  const unlinked: string[] = [];
  english.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const found = find(segment);
      unlinked.push(...found.unlinked);
      if (found.citations.length > 0) (citations[ai] ??= {})[si] = found.citations;
    }),
  );
  return { citations, unlinked };
}
