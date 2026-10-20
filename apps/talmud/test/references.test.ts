import { describe, it, expect } from 'vitest';
import { segmentReader } from '../src/references.ts';

type Amud = { daf: number; amud: 'a' | 'b'; segmentCount: number };
/** Dapim `from` to `to`, `count` segments on each amud. */
const dapim = (from: number, to: number, count: number): Amud[] =>
  Array.from({ length: to - from + 1 }, (_, i) => [
    { daf: from + i, amud: 'a' as const, segmentCount: count },
    { daf: from + i, amud: 'b' as const, segmentCount: count },
  ]).flat();

const read = segmentReader([
  { name: 'Berakhot', hebrewName: 'ברכות', amudim: dapim(2, 30, 5) },
  { name: 'Shabbat', hebrewName: 'שבת', amudim: dapim(2, 3, 2) },
  { name: 'Ketubot', hebrewName: 'כתובות', amudim: dapim(2, 3, 2) },
  { name: 'Bava Kamma', hebrewName: 'בבא קמא', amudim: dapim(2, 3, 2) },
  { name: 'Bava Metzia', hebrewName: 'בבא מציעא', amudim: dapim(2, 3, 2) },
  { name: 'Rosh Hashanah', hebrewName: 'ראש השנה', amudim: dapim(2, 3, 2) },
  { name: 'Avodah Zarah', hebrewName: 'עבודה זרה', amudim: dapim(2, 3, 2) },
  // Tamid begins partway through, and Horayot ends on an a side.
  { name: 'Tamid', hebrewName: 'תמיד', amudim: dapim(25, 26, 2).slice(1) },
  { name: 'Horayot', hebrewName: 'הוריות', amudim: dapim(2, 3, 2).slice(0, 3) },
]);

const idsOf = (typed: string) => read(typed)?.ids ?? null;

describe('segmentReader', () => {
  it('reads tractate, daf, amud and segment as that segment', () => {
    expect(read('Berakhot 3b:4')).toEqual({ ref: 'Berakhot 3b:4', ids: ['Berakhot.3b.4'] });
    expect(read('Bava Kamma 2a:1')).toEqual({
      ref: 'Bava Kamma 2a:1',
      ids: ['Bava.Kamma.2a.1'],
    });
  });

  it('reads the forgiving forms of a segment', () => {
    for (const typed of [
      'Ber. 3b4',
      'berakhot 3b 4',
      'Brachot 3b:4',
      'Berachos 3b.4',
      'Berakhot 3 b 4',
      'Berakhot daf 3b:4',
      'ברכות ג: ד',
      'ברכות ג ע״ב ד',
      'ברכות דף ג עמוד ב ד',
    ]) {
      expect(idsOf(typed), typed).toEqual(['Berakhot.3b.4']);
    }
  });

  it('reads an amud alone as all its segments', () => {
    expect(read('Berakhot 3b')).toEqual({
      ref: 'Berakhot 3b',
      ids: [1, 2, 3, 4, 5].map((s) => `Berakhot.3b.${s}`),
    });
    expect(read('Berakhot 23a:5')?.ids).toEqual(['Berakhot.23a.5']);
    expect(idsOf('ברכות ג:')).toEqual(idsOf('Berakhot 3b'));
    expect(idsOf('ברכות ג.')).toEqual(idsOf('Berakhot 3a'));
    expect(idsOf('ברכות ג ע"א')).toEqual(idsOf('Berakhot 3a'));
    expect(idsOf('ברכות כג ב')).toEqual(idsOf('Berakhot 23b'));
  });

  it('reads a daf alone as both its sides', () => {
    const daf = read('Berakhot 3');
    expect(daf?.ref).toBe('Berakhot 3');
    expect(daf?.ids[0]).toBe('Berakhot.3a.1');
    expect(daf?.ids.at(-1)).toBe('Berakhot.3b.5');
    expect(daf?.ids).toHaveLength(10);
    expect(idsOf('ברכות ג')).toEqual(daf?.ids);
  });

  it('reads a daf with only one side as that side', () => {
    expect(idsOf('Horayot 3')).toEqual(['Horayot.3a.1', 'Horayot.3a.2']);
    expect(idsOf('Tamid 25')).toEqual(['Tamid.25b.1', 'Tamid.25b.2']);
  });

  it('reads a tractate alone as all its segments', () => {
    expect(read('Shabbat')).toEqual({
      ref: 'Shabbat',
      ids: ['2a.1', '2a.2', '2b.1', '2b.2', '3a.1', '3a.2', '3b.1', '3b.2'].map(
        (s) => `Shabbat.${s}`,
      ),
    });
  });

  it('reads the abbreviations readers write tractates as', () => {
    expect(idsOf('BK 2a:1')).toEqual(['Bava.Kamma.2a.1']);
    expect(idsOf('B.M. 2a:1')).toEqual(['Bava.Metzia.2a.1']);
    expect(idsOf('RH 2a:1')).toEqual(['Rosh.Hashanah.2a.1']);
    expect(idsOf('AZ 2a:1')).toEqual(['Avodah.Zarah.2a.1']);
    expect(idsOf('ב״ק ב.')).toEqual(idsOf('Bava Kamma 2a'));
    expect(idsOf('ע״ז ב:')).toEqual(idsOf('Avodah Zarah 2b'));
    expect(idsOf('Shab 2a')).toEqual(idsOf('Shabbat 2a'));
    expect(idsOf('Shabbos 2a')).toEqual(idsOf('Shabbat 2a'));
    expect(idsOf('Kesubos 2a')).toEqual(idsOf('Ketubot 2a'));
  });

  it('reads nothing for a page or segment the tractate does not have', () => {
    for (const typed of [
      'Berakhot 1a',
      'Berakhot 31a',
      'Berakhot 3b:6',
      'Berakhot 3b:0',
      'Tamid 25a',
      'Horayot 3b',
      'Shabbat 4',
    ]) {
      expect(read(typed), typed).toBeNull();
    }
  });

  it('reads nothing that is not a reference', () => {
    for (const typed of [
      '',
      'Bava 2a',
      'Berakhot 3c',
      'Berakhot 3:4',
      'Berakhot 3b:4:5',
      'Talmud',
    ]) {
      expect(read(typed), typed).toBeNull();
    }
  });
});
