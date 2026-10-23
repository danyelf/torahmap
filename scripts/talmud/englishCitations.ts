// The Tanakh verses the English cites. Davidson writes each out beside the quotation, as
// (Deuteronomy 6:7), so the English names its own verses.

import { verseId } from '@torahmap/link/tanakh';
import { englishText } from '@torahmap/talmud/english.ts';
import type { Citation, TalmudTractateEnglish } from '@torahmap/talmud/data.ts';
import type { TanakhBook } from './citations.ts';

/** Spellings the English uses beside the Tanakh's own names: two slips, as the data has them. */
const SPELLINGS: Readonly<Record<string, string>> = { number: 'Numbers', hoshea: 'Hosea' };

/** "see" and "e.g." may open a reference; whatever else does, as "on Job", names no verse. */
const LEAD = String.raw`(?:(?:see|e\.g\.)[,\s]+)*`;

/** A reference that names no verse of the book it opens with, and why. */
export interface Unlinked {
  reference: string;
  reason: string;
}

/**
 * A finder of the references in a segment's English: the parenthesised words, with the first verse
 * they name. A range or a list is linked to its first verse, and a book outside the Tanakh not at all.
 */
export function englishCitationFinder(
  books: readonly Pick<TanakhBook, 'name' | 'chapters'>[],
): (marked: string) => { citations: Citation[]; unlinked: Unlinked[] } {
  const byName = new Map<string, Pick<TanakhBook, 'name' | 'chapters'>>(
    books.map((book) => [book.name.toLowerCase(), book]),
  );
  for (const [spelling, name] of Object.entries(SPELLINGS)) {
    const book = byName.get(name.toLowerCase());
    if (book) byName.set(spelling, book);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  // The English may write the space in "I Kings" as a non-breaking one.
  const spaced = names.map((name) => name.replace(/ /g, String.raw`\s+`));
  const reference = new RegExp(
    String.raw`\(\s*${LEAD}(${spaced.join('|')})[\s:]*(\d+):(\d+)[^()]*\)`,
    'gi',
  );

  return (marked) => {
    const { text } = englishText(marked);
    const citations: Citation[] = [];
    const unlinked: Unlinked[] = [];
    for (const match of text.matchAll(reference)) {
      const book = byName.get(match[1].replace(/\s+/g, ' ').toLowerCase())!;
      const [chapter, verse] = [Number(match[2]), Number(match[3])];
      if (verse < 1 || verse > (book.chapters[chapter - 1] ?? 0)) {
        unlinked.push({
          reference: match[0],
          reason: `${book.name} has no verse ${chapter}:${verse}`,
        });
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

/** The references of a tractate's English, by amud and segment, as `Citation`s in the segment's plain text. */
export function englishCitationsByPlace(
  english: TalmudTractateEnglish,
  find: ReturnType<typeof englishCitationFinder>,
): { citations: Record<number, Record<number, Citation[]>>; unlinked: Unlinked[] } {
  const citations: Record<number, Record<number, Citation[]>> = {};
  const unlinked: Unlinked[] = [];
  english.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const found = find(segment);
      unlinked.push(...found.unlinked);
      if (found.citations.length > 0) (citations[ai] ??= {})[si] = found.citations;
    }),
  );
  return { citations, unlinked };
}
