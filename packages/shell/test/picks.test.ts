import { describe, it, expect } from 'vitest';
import { rgbToOklch } from '@torahmap/utils';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksToUrl,
  pickSlots,
  plainName,
  removePick,
} from '../src/overlays/picks.ts';

const hue = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('colours for the picks', () => {
  const all = pickColors([0, 1, 2, 3]).map(rgbToOklch);

  it('gives each place its own colour, whatever else is picked', () => {
    expect(pickColors([1])[0]).toEqual(pickColors([0, 1])[1]);
    expect(pickColors([1])[0]).not.toEqual(pickColors([0])[0]);
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
  });

  it('keeps a free place between picks, so each pick comes back in its colour', () => {
    expect(picksFromUrl('a,,c')).toEqual(['a', '', 'c']);
    expect(picksFromUrl('a,b,,')).toEqual(['a', 'b']);
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

describe('colours that stay put', () => {
  it('keep a pick in its place when another is removed', () => {
    const picks = { picked: ['lane', 'petra'] };
    const after = removePick('lane')(picks);
    expect(pickSlots(after)).toEqual([{ id: 'petra', slot: 1 }]);
  });

  it('give a new pick the first free place', () => {
    const after = addPick('chaoli')(removePick('lane')({ picked: ['lane', 'petra'] }));
    expect(pickSlots(after)).toEqual([
      { id: 'chaoli', slot: 0 },
      { id: 'petra', slot: 1 },
    ]);
  });

  it('put a new pick after the last when no place is free', () => {
    expect(addPick('c')({ picked: ['a', 'b'] }).picked).toEqual(['a', 'b', 'c']);
  });

  it('count only the picks, not the free places, against the limit', () => {
    const three = removePick('b')({ picked: ['a', 'b', 'c', 'd'] });
    expect(addPick('e')(three).picked).toEqual(['a', 'e', 'c', 'd']);
  });

  it('drop the free places after the last pick', () => {
    expect(removePick('b')({ picked: ['a', 'b'] }).picked).toEqual(['a']);
  });
});

describe('comparing names', () => {
  it('ignores case, accents, vowel points and punctuation', () => {
    expect(plainName('José  O’Neil-Müller')).toBe('jose o neil muller');
    expect(plainName('רַבִּי מֵאִיר')).toBe(plainName('רבי מאיר'));
  });
});
