import { describe, it, expect } from 'vitest';
import { isSegmentMishnah, type TalmudStructure } from '../../talmud/data.ts';

describe('isSegmentMishnah', () => {
  const structure: TalmudStructure = {
    tractates: [
      {
        name: 'Berakhot',
        hebrewName: 'ברכות',
        seder: 'Seder Zeraim',
        firstDaf: 2,
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
