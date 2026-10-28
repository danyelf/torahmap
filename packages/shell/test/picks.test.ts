import { describe, it, expect } from 'vitest';
import { rgbToOklch } from '@torahmap/utils';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksToUrl,
  plainName,
} from '../src/overlays/picks.ts';

const hue = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('colours for the picks', () => {
  const all = pickColors(MAX_PICKS).map(rgbToOklch);

  it('gives each pick a colour by the order picked, whatever else is picked', () => {
    expect(pickColors(2)[0]).toEqual(pickColors(1)[0]);
    expect(pickColors(2)[1]).not.toEqual(pickColors(1)[0]);
  });

  it('has a colour for every pick allowed', () => {
    expect(all).toHaveLength(MAX_PICKS);
  });

  it('makes all equally light', () => {
    for (const other of all) expect(Math.abs(other.l - all[0].l)).toBeLessThan(0.01);
  });

  it('puts the hues far apart', () => {
    for (let a = 0; a < all.length; a++)
      for (let b = a + 1; b < all.length; b++) expect(hue(all[a].h, all[b].h)).toBeGreaterThan(60);
  });
});

describe('the link', () => {
  it('round-trips the picks in order', () => {
    expect(picksFromUrl(picksToUrl(['lakish', 'rabbi-x-(ii)', 'abaye']))).toEqual([
      'lakish',
      'rabbi-x-(ii)',
      'abaye',
    ]);
  });

  it('holds no pick twice and no more than can be told apart', () => {
    expect(picksFromUrl('a,a,b')).toEqual(['a', 'b']);
    expect(picksFromUrl('a,b,c,d,e,f,g,h')).toHaveLength(MAX_PICKS);
    expect(picksFromUrl(undefined)).toEqual([]);
  });
});

describe('picking', () => {
  it('adds to the picks', () => {
    expect(addPick('b')({ picked: ['a'] })).toEqual({ picked: ['a', 'b'] });
  });

  it('changes nothing if already picked', () => {
    const current = { picked: ['a'] };
    expect(addPick('a')(current)).toBe(current);
  });

  it('changes nothing once as many are picked as a square can show', () => {
    const full = { picked: ['a', 'b', 'c', 'd'] };
    expect(addPick('e')(full)).toBe(full);
  });
});

describe('comparing names', () => {
  it('ignores case, accents, vowel points and punctuation', () => {
    expect(plainName('José  O’Neil-Müller')).toBe('jose o neil muller');
    expect(plainName('רַבִּי מֵאִיר')).toBe(plainName('רבי מאיר'));
  });
});
