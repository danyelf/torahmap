import { describe, it, expect, beforeAll } from 'vitest';
import { initBookData } from '../../../src/books';
import { distanceStep } from '../../../src/overlays/text-analytics/distance';

const at = (book: string, chapter = 1) => ({ id: `${book} ${chapter}`, book, chapter, verse: 1 });

describe('distance between verses', () => {
  beforeAll(() => {
    const sections = { Genesis: 'torah', Exodus: 'torah', Isaiah: 'neviim', Psalms: 'ketuvim' };
    const books = [
      ...Object.entries(sections),
      ...['I Kings', 'II Kings', 'Hosea', 'Joel'].map((name) => [name, 'neviim']),
    ];
    initBookData({
      books: books.map(([name, section]) => ({
        name,
        hebrewName: '',
        section: section as 'torah' | 'neviim' | 'ketuvim',
        chapters: [1],
      })),
      layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
    });
  });

  it('is nearest within a chapter, then a book, then a section, then farthest', () => {
    expect(distanceStep(at('Genesis'), at('Genesis'))).toBe(0);
    expect(distanceStep(at('Genesis'), at('Genesis', 2))).toBe(1);
    expect(distanceStep(at('Genesis'), at('Exodus'))).toBe(2);
    expect(distanceStep(at('Genesis'), at('Isaiah'))).toBe(3);
    expect(distanceStep(at('Isaiah'), at('Psalms'))).toBe(3);
  });

  it('counts the halves of a split book, and the minor prophets, as one book', () => {
    expect(distanceStep(at('I Kings'), at('II Kings'))).toBe(1);
    expect(distanceStep(at('Hosea'), at('Joel'))).toBe(1);
    expect(distanceStep(at('I Kings'), at('Hosea'))).toBe(2);
  });
});
