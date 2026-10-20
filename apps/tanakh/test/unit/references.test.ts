import { describe, it, expect } from 'vitest';
import { verseReader } from '../../src/references.ts';

const chapters = (count: number, verses: number) => Array.from({ length: count }, () => verses);

const read = verseReader([
  { name: 'Genesis', hebrewName: 'בראשית', chapters: [3, 2] },
  { name: 'Exodus', hebrewName: 'שמות', chapters: chapters(30, 4) },
  { name: 'Joshua', hebrewName: 'יהושע', chapters: [2] },
  { name: 'I Samuel', hebrewName: 'שמואל א', chapters: [2, 2, 20] },
  { name: 'II Samuel', hebrewName: 'שמואל ב', chapters: [2] },
  { name: 'II Kings', hebrewName: 'מלכים ב', chapters: chapters(17, 3) },
  { name: 'Isaiah', hebrewName: 'ישעיהו', chapters: chapters(40, 2) },
  { name: 'Psalms', hebrewName: 'תהלים', chapters: chapters(3, 2) },
  { name: 'Job', hebrewName: 'איוב', chapters: [2] },
  { name: 'Song of Songs', hebrewName: 'שיר השירים', chapters: [2] },
  { name: 'Ecclesiastes', hebrewName: 'קהלת', chapters: [2] },
]);

const idsOf = (typed: string) => read(typed)?.ids ?? null;
const refOf = (typed: string) => read(typed)?.ref ?? null;

describe('verseReader', () => {
  it('reads book, chapter and verse as the square of that verse', () => {
    expect(read('I Samuel 3:17')).toEqual({ ref: 'I Samuel 3:17', ids: ['I.Samuel.3.17'] });
  });

  it('reads the forgiving forms of a verse', () => {
    for (const typed of [
      '1 Sam 3:17',
      'I Sam. 3.17',
      '1 Samuel 3 17',
      '1Sam3:17',
      'i samuel 3:17',
      'שמואל א ג:יז',
      'שמואל א ג יז',
      'שמואל א פרק ג פסוק יז',
      'I Samuel chapter 3 verse 17',
    ]) {
      expect(idsOf(typed), typed).toEqual(['I.Samuel.3.17']);
    }
  });

  it('reads a chapter alone as all its verses, in order', () => {
    expect(read('Genesis 1')).toEqual({
      ref: 'Genesis 1',
      ids: ['Genesis.1.1', 'Genesis.1.2', 'Genesis.1.3'],
    });
    expect(idsOf('Isaiah 40')).toEqual(['Isaiah.40.1', 'Isaiah.40.2']);
    expect(idsOf('ישעיהו מ')).toEqual(['Isaiah.40.1', 'Isaiah.40.2']);
    expect(refOf('II Kings 17')).toBe('II Kings 17');
  });

  it('reads a book alone as all its verses', () => {
    expect(read('Genesis')).toEqual({
      ref: 'Genesis',
      ids: ['Genesis.1.1', 'Genesis.1.2', 'Genesis.1.3', 'Genesis.2.1', 'Genesis.2.2'],
    });
    expect(idsOf('שמואל ב')).toEqual(['II.Samuel.1.1', 'II.Samuel.1.2']);
  });

  it('reads a range of verses within a chapter or across chapters', () => {
    expect(read('Genesis 1:2-3')).toEqual({
      ref: 'Genesis 1:2–3',
      ids: ['Genesis.1.2', 'Genesis.1.3'],
    });
    expect(read('Gen 1:3–2:1')).toEqual({
      ref: 'Genesis 1:3–2:1',
      ids: ['Genesis.1.3', 'Genesis.2.1'],
    });
    expect(read('Psalms 1-2')).toEqual({
      ref: 'Psalms 1–2',
      ids: ['Psalms.1.1', 'Psalms.1.2', 'Psalms.2.1', 'Psalms.2.2'],
    });
  });

  it('reads a Hebrew chapter whose letters are also a word', () => {
    // כה is "thus" as well as 25.
    expect(idsOf('שמות כה')).toHaveLength(4);
    expect(idsOf('שמות כה')?.[0]).toBe('Exodus.25.1');
  });

  it('reads the names readers abbreviate books to', () => {
    expect(idsOf('Ps 3:1')).toEqual(['Psalms.3.1']);
    expect(idsOf('Pss 3:1')).toEqual(['Psalms.3.1']);
    expect(idsOf('Psalm 3:1')).toEqual(['Psalms.3.1']);
    expect(idsOf('2 Kgs 17:3')).toEqual(['II.Kings.17.3']);
    expect(idsOf('Qoh 1:2')).toEqual(['Ecclesiastes.1.2']);
    expect(idsOf('Kohelet 1:2')).toEqual(['Ecclesiastes.1.2']);
    expect(idsOf('Song of Solomon 1:1')).toEqual(['Song.of.Songs.1.1']);
    expect(idsOf('Shemot 1:1')).toEqual(['Exodus.1.1']);
    expect(idsOf('Tehillim 1:1')).toEqual(['Psalms.1.1']);
  });

  it('reads nothing for a chapter or verse the book does not have', () => {
    expect(read('Genesis 3')).toBeNull();
    expect(read('Genesis 1:4')).toBeNull();
    expect(read('Genesis 0')).toBeNull();
    expect(read('Genesis 1:3-9')).toBeNull();
    expect(read('Genesis 2:1-1:3')).toBeNull();
  });

  it('reads nothing that is not a reference', () => {
    for (const typed of ['', 'Matthew 1:1', 'Jo 1', 'Samuel 3:17', 'Genesis 1:2:3', 'Genesis x']) {
      expect(read(typed), typed).toBeNull();
    }
  });

  it('never reads a single letter as a reference', () => {
    expect(read('G')).toBeNull();
    expect(read('G 1')).toBeNull();
  });
});
