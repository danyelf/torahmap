import { describe, it, expect } from 'vitest';
import { amudIndex, isSegmentMishnah, type TalmudStructure } from '../src/data.ts';

describe('isSegmentMishnah', () => {
  const structure: TalmudStructure = {
    tractates: [
      {
        name: 'Berakhot',
        hebrewName: 'ברכות',
        seder: 'Zeraim',
        amudim: [
          { daf: 2, amud: 'a', segmentCount: 3, perekIdx: 0, mishnahMask: [true, true, false] },
          { daf: 2, amud: 'b', segmentCount: 2, perekIdx: 0, mishnahMask: [false, false] },
        ],
        perakim: [
          {
            hebrewName: 'פרק א',
            startAmudIdx: 0,
            endAmudIdx: 1,
            startSegmentInFirstAmud: 1,
            endSegmentInLastAmud: 2,
          },
        ],
      },
    ],
  };

  it('returns true for a Mishnah segment', () => {
    expect(isSegmentMishnah(structure, 'Berakhot', 2, 'a', 1)).toBe(true);
    expect(isSegmentMishnah(structure, 'Berakhot', 2, 'a', 2)).toBe(true);
  });

  it('returns false for a Gemara segment', () => {
    expect(isSegmentMishnah(structure, 'Berakhot', 2, 'a', 3)).toBe(false);
    expect(isSegmentMishnah(structure, 'Berakhot', 2, 'b', 1)).toBe(false);
  });

  it('returns false for an unknown tractate', () => {
    expect(isSegmentMishnah(structure, 'Nonexistent', 2, 'a', 1)).toBe(false);
  });

  it('returns false for an out-of-range daf', () => {
    expect(isSegmentMishnah(structure, 'Berakhot', 99, 'a', 1)).toBe(false);
  });
});

describe('amudIndex', () => {
  it('counts amudim from the tractate’s first', () => {
    expect(amudIndex(2, 'a', { daf: 2, amud: 'a' })).toBe(0);
    expect(amudIndex(2, 'b', { daf: 2, amud: 'a' })).toBe(1);
    expect(amudIndex(3, 'a', { daf: 2, amud: 'a' })).toBe(2);
  });

  it('counts from a tractate that opens on a b side, as Tamid does', () => {
    expect(amudIndex(25, 'b', { daf: 25, amud: 'b' })).toBe(0);
    expect(amudIndex(26, 'a', { daf: 25, amud: 'b' })).toBe(1);
  });
});
