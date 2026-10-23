import { describe, it, expect } from 'vitest';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { provisionReader } from '../src/references.ts';

const { read, complete } = provisionReader([
  'Recital.1',
  'Recital.12',
  '4a(1)',
  '4a(1)(a)',
  '5(1)',
  '5(1)(a)',
  '5(1)(h)',
  '5(1)(h)(i)',
  '5(1a)',
  '5(1a)(a)',
  '5(2)',
  '3(14)',
  '3(14a)',
  '6',
  'Annex.I.1.1',
  'Annex.III.1.1',
  'Annex.III.1.2',
  'Annex.III.2.1',
]);

const idsOf = (typed: string) => read(typed)?.ids ?? null;

describe('provisionReader', () => {
  it('reads a lettered paragraph as its own, and a letter after a parenthesis as a point', () => {
    expect(idsOf('Article 5(1a)')).toEqual(['5(1a)', '5(1a)(a)']);
    expect(idsOf('Article 5(1a)(a)')).toEqual(['5(1a)(a)']);
    expect(idsOf('Article 5(1)(a)')).toEqual(['5(1)(a)']);
    expect(idsOf('Article 3(14a)')).toEqual(['3(14a)']);
  });

  it('reads an article, paragraph and point as that square', () => {
    expect(read('Article 5(1)(h)')).toEqual({
      ref: 'Article 5(1)(h)',
      ids: ['5(1)(h)', '5(1)(h)(i)'],
    });
    expect(read('Article 5(1)(h)(i)')?.ids).toEqual(['5(1)(h)(i)']);
  });

  it('reads the forgiving forms of an article', () => {
    for (const typed of [
      'art 5(1)(h)',
      'Art. 5 1 h',
      '5(1)(h)',
      'article 5.1.h',
      'ARTICLE 5(1)h',
    ]) {
      expect(read(typed)?.ref, typed).toBe('Article 5(1)(h)');
    }
  });

  it('reads an article or paragraph alone as all its squares', () => {
    expect(read('Article 5')).toEqual({
      ref: 'Article 5',
      ids: ['5(1)', '5(1)(a)', '5(1)(h)', '5(1)(h)(i)', '5(1a)', '5(1a)(a)', '5(2)'],
    });
    expect(idsOf('Art 5(1)')).toEqual(['5(1)', '5(1)(a)', '5(1)(h)', '5(1)(h)(i)']);
    expect(idsOf('Article 6')).toEqual(['6']);
  });

  it('reads an article whose number has a letter', () => {
    expect(read('Article 4a')).toEqual({ ref: 'Article 4a', ids: ['4a(1)', '4a(1)(a)'] });
    expect(idsOf('Art 4a(1)(a)')).toEqual(['4a(1)(a)']);
  });

  it('reads a recital', () => {
    expect(read('Recital 12')).toEqual({ ref: 'Recital 12', ids: ['Recital.12'] });
    expect(idsOf('rec. 1')).toEqual(['Recital.1']);
  });

  it('reads an annex by Roman or Arabic number, and a section of one', () => {
    expect(read('Annex III')).toEqual({
      ref: 'Annex III',
      ids: ['Annex.III.1.1', 'Annex.III.1.2', 'Annex.III.2.1'],
    });
    expect(idsOf('Annex 3')).toEqual(idsOf('Annex III'));
    expect(idsOf('annex iii')).toEqual(idsOf('Annex III'));
    expect(read('Annex III 1')).toEqual({
      ref: 'Annex III 1',
      ids: ['Annex.III.1.1', 'Annex.III.1.2'],
    });
    expect(idsOf('Annex III(1)(2)')).toEqual(['Annex.III.1.2']);
  });

  it('reads nothing for a provision the Act does not have', () => {
    for (const typed of [
      'Article 7',
      'Article 5(3)',
      'Article 5(1)(z)',
      'Recital 2',
      'Annex II',
      'Annex 99',
    ]) {
      expect(read(typed), typed).toBeNull();
    }
  });

  it('reads nothing that is not a reference', () => {
    for (const typed of ['', 'Article', 'Recital', 'deployer', 'Annex x', 'Recital 12 3']) {
      expect(read(typed), typed).toBeNull();
    }
  });
});

describe('provisionReader completion', () => {
  it('offers, in one step, places of the part that starts as typed, each of which reads', () => {
    for (const typed of ['a', 'art', 'Article', 'Article ', 'ann', 'Annex', 'reci']) {
      const offered = complete(typed);
      expect(offered.length, typed).toBeGreaterThan(0);
      for (const place of offered) expect(read(place), place).not.toBeNull();
    }
  });

  it('offers only places that the typed number starts', () => {
    const offered = complete('art 5');
    expect(offered.length).toBeGreaterThan(0);
    for (const place of offered) expect(read(place)?.ids[0].startsWith('5')).toBe(true);
  });

  it('offers the article an article number with a letter names', () => {
    expect(complete('art 4').map((place) => read(place)?.ids[0])).toContain('4a(1)');
  });
});

describe('provisionReader writing', () => {
  it('says every reference is in English', () => {
    expect(provisionReader([]).languageOf('Article 5')).toBe(ENGLISH);
  });
});
