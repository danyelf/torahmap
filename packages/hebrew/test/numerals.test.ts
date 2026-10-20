import { describe, it, expect } from 'vitest';
import { hebrewNumber } from '../src/index.ts';

describe('hebrewNumber', () => {
  it('reads units, tens and hundreds', () => {
    expect(hebrewNumber('א')).toBe(1);
    expect(hebrewNumber('ט')).toBe(9);
    expect(hebrewNumber('י')).toBe(10);
    expect(hebrewNumber('יז')).toBe(17);
    expect(hebrewNumber('מ')).toBe(40);
    expect(hebrewNumber('קנ')).toBe(150);
    expect(hebrewNumber('קעו')).toBe(176);
  });

  it('reads 15 and 16 as they are written, ט before ו and ז', () => {
    expect(hebrewNumber('טו')).toBe(15);
    expect(hebrewNumber('טז')).toBe(16);
  });

  it('reads final letters as their plain ones', () => {
    expect(hebrewNumber('ך')).toBe(20);
    expect(hebrewNumber('קם')).toBe(140);
  });

  it('ignores geresh and gershayim, in Hebrew or typed as quotes', () => {
    expect(hebrewNumber('ג׳')).toBe(3);
    expect(hebrewNumber('י״ז')).toBe(17);
    expect(hebrewNumber('י"ז')).toBe(17);
    expect(hebrewNumber("ג'")).toBe(3);
  });

  it('ignores points', () => {
    expect(hebrewNumber('יְז')).toBe(17);
  });

  it('refuses letters out of order, which make a word rather than a number', () => {
    expect(hebrewNumber('זי')).toBeNull();
    expect(hebrewNumber('אב')).toBeNull();
  });

  it('refuses anything but Hebrew letters', () => {
    expect(hebrewNumber('')).toBeNull();
    expect(hebrewNumber('17')).toBeNull();
    expect(hebrewNumber('יz')).toBeNull();
    expect(hebrewNumber('״')).toBeNull();
  });
});
