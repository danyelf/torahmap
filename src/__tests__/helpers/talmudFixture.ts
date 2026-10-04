import type { TalmudStructure } from '../../talmud/data.ts';

// Synthetic fixture: two tractates in two different sedarim.
// Tractate A has 2 perakim, 4 amudim total. Tractate B has 1 perek, 2 amudim.
export const talmudFixture: TalmudStructure = {
  tractates: [
    {
      name: 'TractA',
      hebrewName: 'א',
      seder: 'Seder Zeraim',
      firstDaf: 2,
      amudim: [
        {
          daf: 2,
          amud: 'a',
          segmentCount: 5,
          perekIdx: 0,
          mishnahMask: [true, false, false, false, false],
        },
        {
          daf: 2,
          amud: 'b',
          segmentCount: 4,
          perekIdx: 0,
          mishnahMask: [false, false, false, false],
        },
        {
          daf: 3,
          amud: 'a',
          segmentCount: 6,
          perekIdx: 0,
          mishnahMask: [false, false, false, false, false, false],
        },
        { daf: 3, amud: 'b', segmentCount: 3, perekIdx: 1, mishnahMask: [true, false, false] },
      ],
      perakim: [
        {
          hebrewName: 'פרק א',
          startAmudIdx: 0,
          endAmudIdx: 2,
          startSegmentInFirstAmud: 1,
          endSegmentInLastAmud: 6,
        },
        {
          hebrewName: 'פרק ב',
          startAmudIdx: 3,
          endAmudIdx: 3,
          startSegmentInFirstAmud: 1,
          endSegmentInLastAmud: 3,
        },
      ],
    },
    {
      name: 'TractB',
      hebrewName: 'ב',
      seder: 'Seder Moed',
      firstDaf: 2,
      amudim: [
        {
          daf: 2,
          amud: 'a',
          segmentCount: 4,
          perekIdx: 0,
          mishnahMask: [true, false, false, false],
        },
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
