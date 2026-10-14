import { hebrewNumeral } from '../src/index.ts';
import { describe, it, expect } from 'vitest';

describe('hebrewNumeral', () => {
  it.each([
    ['א', 1],
    ['ט', 9],
    ['י', 10],
    ['יא', 11],
    ['כז', 27],
    ['צט', 99],
    ['ק', 100],
    ['קי', 110],
    ['קיט', 119],
    ['קנ', 150],
  ])('reads %s', (numeral, value) => {
    expect(hebrewNumeral(numeral)).toBe(value);
  });

  it('writes fifteen and sixteen as nine and six, nine and seven', () => {
    expect(hebrewNumeral('טו')).toBe(15);
    expect(hebrewNumeral('טז')).toBe(16);
    expect(hebrewNumeral('קטז')).toBe(116);
    expect(hebrewNumeral('יה')).toBeNull();
    expect(hebrewNumeral('יו')).toBeNull();
  });

  it('reads past a geresh or gershayim, Hebrew or ASCII', () => {
    expect(hebrewNumeral('ג׳')).toBe(3);
    expect(hebrewNumeral("ג'")).toBe(3);
    expect(hebrewNumeral('כ״ז')).toBe(27);
    expect(hebrewNumeral('ט"ו')).toBe(15);
  });

  it('refuses a word that is not a numeral', () => {
    for (const word of ['', 'אל', 'בא', 'ככ', 'יכ', 'שם', 'ם', 'abc']) {
      expect(hebrewNumeral(word)).toBeNull();
    }
  });
});
