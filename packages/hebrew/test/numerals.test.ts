import { describe, it, expect } from 'vitest';
import { hebrewNumber, withoutPointsOrGeresh, writtenNumber } from '../src/index.ts';

describe('hebrewNumber', () => {
  it('reads units, tens and hundreds', () => {
    expect(hebrewNumber('א')).toBe(1);
    expect(hebrewNumber('ט')).toBe(9);
    expect(hebrewNumber('י')).toBe(10);
    expect(hebrewNumber('יז')).toBe(17);
    expect(hebrewNumber('מ')).toBe(40);
    expect(hebrewNumber('קנ')).toBe(150);
    expect(hebrewNumber('קעו')).toBe(176);
    expect(hebrewNumber('צט')).toBe(99);
    expect(hebrewNumber('קיט')).toBe(119);
  });

  it('reads 15 and 16 as they are written, ט before ו and ז', () => {
    expect(hebrewNumber('טו')).toBe(15);
    expect(hebrewNumber('טז')).toBe(16);
  });

  it('refuses final letters, which no numeral is written with, so a word such as שם is no number', () => {
    expect(hebrewNumber('ך')).toBeNull();
    expect(hebrewNumber('קם')).toBeNull();
    expect(hebrewNumber('שם')).toBeNull();
  });

  it('refuses יה and יו, never written for 15 and 16', () => {
    expect(hebrewNumber('יה')).toBeNull();
    expect(hebrewNumber('יו')).toBeNull();
    expect(hebrewNumber('קטז')).toBe(116);
  });

  it('refuses a hundred, a ten or a unit written twice', () => {
    expect(hebrewNumber('ככ')).toBeNull();
    expect(hebrewNumber('קק')).toBeNull();
    expect(hebrewNumber('יכ')).toBeNull();
  });

  it('ignores geresh and gershayim, in Hebrew or typed as quotes', () => {
    expect(hebrewNumber('ג׳')).toBe(3);
    expect(hebrewNumber('י״ז')).toBe(17);
    expect(hebrewNumber('י"ז')).toBe(17);
    expect(hebrewNumber("ג'")).toBe(3);
    expect(hebrewNumber('ג’')).toBe(3);
    expect(hebrewNumber('ג‘')).toBe(3);
    expect(hebrewNumber('ג`')).toBe(3);
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

describe('withoutPointsOrGeresh', () => {
  it('drops points, geresh, gershayim and the quotes typed for them, and nothing else', () => {
    expect(withoutPointsOrGeresh('שְׁמ֑וֹת י״ז')).toBe('שמות יז');
    expect(withoutPointsOrGeresh(`ע'א ע"ב ג’ ג‘ ג\``)).toBe('עא עב ג ג ג');
    expect(withoutPointsOrGeresh('Ta-anit 2:3')).toBe('Ta-anit 2:3');
  });
});

describe('writtenNumber', () => {
  it('reads a number written in digits or in Hebrew letters', () => {
    expect(writtenNumber('17')).toBe(17);
    expect(writtenNumber('יז')).toBe(17);
  });

  it('reads nothing from a word', () => {
    expect(writtenNumber('a')).toBeNull();
    expect(writtenNumber('זי')).toBeNull();
    expect(writtenNumber('1a')).toBeNull();
  });
});
