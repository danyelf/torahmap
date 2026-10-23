import { describe, it, expect } from 'vitest';
import { soundOfName } from '../src/index.ts';

const alike = (...words: string[]) => new Set(words.map(soundOfName)).size === 1;

describe('soundOfName', () => {
  it('writes the usual spellings of one name alike', () => {
    expect(alike('berakhot', 'brachot', 'berachos')).toBe(true);
    expect(alike('shabbat', 'shabbos')).toBe(true);
    expect(alike('pesachim', 'pesahim')).toBe(true);
    expect(alike('chullin', 'hullin')).toBe(true);
    expect(alike('kiddushin', 'qiddushin')).toBe(true);
    expect(alike('sukkah', 'succah', 'suka')).toBe(true);
    expect(alike('megillah', 'megila')).toBe(true);
    expect(alike('taanit', 'taanis')).toBe(true);
  });

  it('writes a Hebrew name alike with or without its vowel letters and final forms', () => {
    expect(alike('חולין', 'חלין', 'חלינ')).toBe(true);
  });

  it('keeps different names apart', () => {
    expect(alike('shabbat', 'sotah')).toBe(false);
    expect(alike('berakhot', 'bekhorot')).toBe(false);
  });
});
