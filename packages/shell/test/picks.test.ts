import { describe, it, expect } from 'vitest';
import {
  addPick,
  MAX_PICKS,
  pickColors,
  picksFromUrl,
  picksInUse,
  picksToUrl,
  pickSlots,
  plainName,
  removePick,
} from '../src/overlays/picks.ts';
import { PALETTE } from '../src/overlays/palette.ts';

describe('colours for the picks', () => {
  it('are the palette colours at those places', () => {
    expect(pickColors([2, 0])).toEqual([PALETTE[2], PALETTE[0]]);
  });
});

describe('the link', () => {
  it('round-trips the picks in order', () => {
    expect(picksFromUrl(picksToUrl(['lakish', 'rabbi-x-(ii)', 'abaye']), [])).toEqual([
      'lakish',
      'rabbi-x-(ii)',
      'abaye',
    ]);
  });

  it('holds no pick twice and no more than can be told apart', () => {
    expect(picksFromUrl('a,a,b', [])).toEqual(['a', 'b']);
    expect(picksFromUrl('a,b,c,d,e,f,g,h', [])).toHaveLength(MAX_PICKS);
    expect(picksFromUrl(undefined, [])).toEqual([]);
  });

  it('does not carry colours: free places are left out', () => {
    expect(picksToUrl(['a', '', 'c'])).toBe('a,c');
  });

  it('gives each pick in a link the first colour the words and earlier picks are not using', () => {
    const picked = picksFromUrl('a,b', [0, 2]);

    expect(pickSlots({ picked })).toEqual([
      { id: 'a', slot: 1 },
      { id: 'b', slot: 3 },
    ]);
  });
});

describe('picking', () => {
  it('adds to the picks', () => {
    expect(addPick('b')({ picked: ['a'] }, []).picked).toEqual(['a', 'b']);
  });

  it('changes nothing if already picked', () => {
    const current = { picked: ['a'] };
    expect(addPick('a')(current, [])).toBe(current);
  });

  it('changes nothing once as many are picked as a square can show', () => {
    const full = { picked: ['a', 'b', 'c', 'd'] };
    expect(addPick('e')(full, [])).toBe(full);
  });

  it('takes a colour the words are not using', () => {
    expect(pickSlots(addPick('a')({ picked: [] }, [0, 1]))).toEqual([{ id: 'a', slot: 2 }]);
  });
});

describe('colours that stay put', () => {
  it('keep a pick in its place when another is removed', () => {
    const picks = { picked: ['lane', 'petra'] };
    const after = removePick('lane')(picks, []);
    expect(pickSlots(after)).toEqual([{ id: 'petra', slot: 1 }]);
  });

  it('give a new pick the first free colour', () => {
    const after = addPick('chaoli')(removePick('lane')({ picked: ['lane', 'petra'] }, []), []);
    expect(pickSlots(after)).toEqual([
      { id: 'chaoli', slot: 0 },
      { id: 'petra', slot: 1 },
    ]);
  });

  it('leave a gap where a word holds the colour in between', () => {
    expect(addPick('b')({ picked: ['a'] }, [1]).picked).toEqual(['a', '', 'b']);
  });

  it('count only the picks, not the free places, against the limit', () => {
    const three = removePick('b')({ picked: ['a', 'b', 'c', 'd'] }, []);
    expect(addPick('e')(three, []).picked).toEqual(['a', 'e', 'c', 'd']);
  });

  it('drop the free places after the last pick', () => {
    expect(removePick('b')({ picked: ['a', 'b'] }, []).picked).toEqual(['a']);
  });

  it('are the ones a word must keep out of', () => {
    expect(picksInUse({ picked: ['a', '', 'c'] })).toEqual([0, 2]);
  });
});

describe('comparing names', () => {
  it('ignores case, accents, vowel points and punctuation', () => {
    expect(plainName('José  O’Neil-Müller')).toBe('jose o neil muller');
    expect(plainName('רַבִּי מֵאִיר')).toBe(plainName('רבי מאיר'));
  });
});
