import { describe, it, expect } from 'vitest';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';
import { verseReader } from '../../src/references.ts';

const chapters = (count: number, verses: number) => Array.from({ length: count }, () => verses);

const { read, complete } = verseReader([
  { name: 'Genesis', hebrewName: 'בראשית', chapters: [3, 2] },
  { name: 'Exodus', hebrewName: 'שמות', chapters: chapters(30, 4) },
  { name: 'Joshua', hebrewName: 'יהושע', chapters: [2] },
  { name: 'I Samuel', hebrewName: 'שמואל א', chapters: [2, 2, 20] },
  { name: 'II Samuel', hebrewName: 'שמואל ב', chapters: [2] },
  { name: 'I Kings', hebrewName: 'מלכים א', chapters: [2] },
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
    expect(idsOf('Genesis 1:2-3')).toEqual(['Genesis.1.2', 'Genesis.1.3']);
    expect(idsOf('Gen 1:3–2:1')).toEqual(['Genesis.1.3', 'Genesis.2.1']);
    expect(idsOf('Psalms 1-2')).toEqual(['Psalms.1.1', 'Psalms.1.2', 'Psalms.2.1', 'Psalms.2.2']);
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

describe('verseReader names', () => {
  it('reads a Hebrew book number as part of the name, not as its chapter', () => {
    expect(idsOf('שמואל ב א:ב')).toEqual(['II.Samuel.1.2']);
  });

  it('reads Hebrew written with final letters or without', () => {
    expect(idsOf('תהלימ א:א')).toEqual(idsOf('תהלים א:א'));
  });

  it('reads a Roman numeral, a digit or neither before a numbered book', () => {
    expect(idsOf('II Sam 1:2')).toEqual(['II.Samuel.1.2']);
    expect(idsOf('2Sam 1:2')).toEqual(['II.Samuel.1.2']);
  });
});

describe('verseReader completion', () => {
  it('offers the books that start as typed, by the name that fits', () => {
    expect(complete('jo')).toEqual(['Joshua', 'Job']);
    expect(complete('shem')).toEqual(['Shemot']);
    expect(complete('שמ')).toEqual(['שמות', 'שמואל א', 'שמואל ב']);
  });

  it('reads a book number as a digit or a Roman numeral', () => {
    expect(complete('1 sa')).toEqual(['I Samuel']);
    expect(complete('II S')).toEqual(['II Samuel']);
    expect(complete('I')).toEqual(['I Samuel', 'I Kings']);
  });

  it('offers every book a later word of whose name starts as typed', () => {
    expect(complete('Sam')).toEqual(['I Samuel', 'II Samuel']);
    expect(complete('Samuel')).toEqual(['I Samuel', 'II Samuel']);
  });

  it('offers nothing once a book is named in full, or numbers follow', () => {
    expect(complete('Job')).toEqual([]);
    expect(complete('שמואל א')).toEqual([]);
    expect(complete('Isaiah 4')).toEqual([]);
    expect(complete('שמות כ')).toEqual([]);
  });
});

describe('verseReader spellings', () => {
  const songs = idsOf('Song of Songs 1:1');

  it('reads a Hebrew name in English letters however it is spelled', () => {
    expect(idsOf('Shir Hashirim 1:1')).toEqual(songs);
    expect(idsOf('Shir Hashireem 1:1')).toEqual(songs);
  });

  it('reads an English name only as it is written', () => {
    expect(idsOf('Canticles 1:1')).toEqual(songs);
    expect(read('Kantikles 1:1')).toBeNull();
    expect(read('kin 1')).toBeNull();
  });
});

describe('verseReader writing', () => {
  it('reads Hebrew written with points, geresh or gershayim', () => {
    expect(idsOf('שְׁמוּאֵל א ג׳:י״ז')).toEqual(['I.Samuel.3.17']);
  });

  it('says a reference typed in Hebrew is in Hebrew', () => {
    expect(verseReader([]).languageOf('שמות כב')).toBe(HEBREW);
    expect(verseReader([]).languageOf('Exodus 22')).toBe(ENGLISH);
  });
});

describe('verseReader references', () => {
  it('names each place by a reference that reads back to it', () => {
    for (const typed of [
      'Genesis',
      'Genesis 1',
      'Genesis 1:2',
      'Genesis 1:1-3',
      'Genesis 1:2-2:1',
      'Isaiah 1-3',
    ]) {
      const found = read(typed)!;
      expect(read(found.ref)?.ids, typed).toEqual(found.ids);
    }
  });
});

describe('verseReader short starts', () => {
  it('reads two letters only as written, never by sound', () => {
    expect(read('ka 1')).toBeNull();
    expect(read('kah 1')?.ids).toEqual(idsOf('Ecclesiastes 1'));
  });

  it('offers both books of Kings for kin', () => {
    expect(complete('kin')).toEqual(expect.arrayContaining(['I Kings', 'II Kings']));
  });
});
