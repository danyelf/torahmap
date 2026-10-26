import { describe, it, expect } from 'vitest';
import { rgbToOklch } from '@torahmap/utils';
import { MISHNAH_BASE_COLOR } from '../src/constants.ts';
import { generationColor } from '../src/overlays/dating.ts';
import { UNDATED, type Rabbi, type TalmudDating } from '../src/dating.ts';
import {
  namedIn,
  passagesOf,
  pickColors,
  pickedPlaces,
  picksFromUrl,
  picksToUrl,
  quickPicks,
  suggest,
  type RabbiData,
} from '../src/overlays/rabbiPicks.ts';

const rabbis: Rabbi[] = [
  {
    id: 'gamliel-a',
    en: 'Rabban Gamliel haZaken',
    he: 'רבן גמליאל הזקן',
    gen: 'T1',
    names: ['Gamliel'],
  },
  {
    id: 'gamliel-b',
    en: 'Rabban Gamliel b. Rabbi',
    he: 'רבן גמליאל',
    gen: 'TA',
    names: ['Gamliel'],
  },
  {
    id: 'lakish',
    en: 'Rabbi Shimon b. Lakish',
    he: 'רבי שמעון בן לקיש',
    gen: 'A2',
    names: ['#Reish Lakish', 'ריש לָקִישׁ'],
  },
  { id: 'yochanan', en: 'Rabbi Yochanan', he: 'רבי יוחנן', gen: 'A2', names: [] },
  { id: 'abaye', en: 'Abaye', he: 'אביי', gen: 'A4', names: [] },
];

const dating: TalmudDating = {
  generations: [{ code: 'TA', from: 200, to: 220 }],
  people: [
    { id: 'gamliel-(ambiguous)', en: 'Rabban Gamliel', he: 'רבן גמליאל', gen: 0, means: [0, 1] },
    { id: 'lakish', en: 'Rabbi Shimon b. Lakish', he: '', gen: 0, means: [2] },
    { id: 'yochanan', en: 'Rabbi Yochanan', he: '', gen: 0, means: [3] },
    { id: 'abaye', en: 'Abaye', he: '', gen: 0, means: [4] },
    { id: 'abaye-(ambiguous)', en: 'Abaye?', he: '', gen: 0, means: [4] },
  ],
  rabbis,
  segments: {
    'A.2a.1': [0, 0, [1, 2, 0], []],
    'A.2a.2': [0, 0, [1, 2], []],
    'A.2a.3': [0, 1, [0], []],
    'A.2a.4': [0, 0, [0, 1], []],
    'A.2a.5': [0, 0, [3, 4, 0], []],
  },
};

const data: RabbiData = { dating };
const place = (id: string) => rabbis.findIndex((r) => r.id === id);

describe('which passages name a rabbi', () => {
  it('finds exactly the passages tagged with him', () => {
    const named = ['A.2a.1', 'A.2a.2', 'A.2a.3', 'A.2a.4', 'A.2a.5'].filter(
      (id) => namedIn(data, id, [place('lakish')]).size > 0,
    );
    expect(named).toEqual(['A.2a.1', 'A.2a.2', 'A.2a.4']);
  });

  it('knows which of the picked rabbis a passage names', () => {
    const both = [place('lakish'), place('yochanan')];
    expect([...namedIn(data, 'A.2a.1', both).keys()]).toEqual(both);
    expect([...namedIn(data, 'A.2a.4', both).keys()]).toEqual([place('lakish')]);
  });

  it('is sure of a rabbi a name settles and unsure of one it only might mean', () => {
    expect(namedIn(data, 'A.2a.1', [place('lakish')]).get(place('lakish'))).toBe('sure');
    expect(namedIn(data, 'A.2a.3', [place('gamliel-a')]).get(place('gamliel-a'))).toBe('maybe');
  });

  it('is sure when any one name in the passage settles it', () => {
    expect(namedIn(data, 'A.2a.4', [place('gamliel-a')]).get(place('gamliel-a'))).toBe('maybe');
    expect(namedIn(data, 'A.2a.4', [place('lakish')]).get(place('lakish'))).toBe('sure');
  });

  it('counts a rabbi’s passages for certain and else', () => {
    expect(passagesOf(data, place('lakish'))).toEqual({ sure: 3, maybe: 0 });
    expect(passagesOf(data, place('gamliel-a'))).toEqual({ sure: 0, maybe: 4 });
  });

  it('drops picks the data does not hold', () => {
    expect(pickedPlaces({ picked: ['nobody', 'lakish'] }, data)).toEqual([place('lakish')]);
  });
});

describe('finding a rabbi', () => {
  const found = (typed: string) => suggest(data, typed).map(({ place: p }) => rabbis[p].id);

  it('matches another name he is known by', () => {
    expect(found('Resh Lakish')).toEqual([]);
    expect(found('reish lakish')).toEqual(['lakish']);
  });

  it('matches Hebrew names with vowel points on either side', () => {
    expect(found('ריש לקיש')).toEqual(['lakish']);
  });

  it('offers each person of a shared name, so the reader chooses', () => {
    expect(found('Gamliel').sort()).toEqual(['gamliel-a', 'gamliel-b']);
  });

  it('says which of his names matched when it is not his main one', () => {
    expect(suggest(data, 'reish')[0].matched).toBe('#Reish Lakish');
    expect(suggest(data, 'abaye')[0].matched).toBeNull();
  });

  it('leaves out rabbis already picked', () => {
    expect(suggest(data, 'Gamliel', [place('gamliel-a')]).map((s) => s.place)).toEqual([
      place('gamliel-b'),
    ]);
  });
});

describe('the quick picks', () => {
  it('are grouped by era, each group in generation order', () => {
    const groups = quickPicks(data);
    expect(groups.map((g) => g.heading)).toEqual(['Tanna/Amora transition', 'Amoraim']);
    expect(groups.map((g) => g.entries.map((e) => e.en))).toEqual([
      ['Rabban Gamliel'],
      ['Rabbi Shimon b. Lakish', 'Rabbi Yochanan', 'Abaye'],
    ]);
  });

  it('offer the one rabbi a name can mean, without asking which, when only he has a generation', () => {
    const narrowed = {
      dating: {
        ...dating,
        people: [{ ...dating.people[0], means: [0] }, ...dating.people.slice(1)],
      },
    };
    const entries = quickPicks(narrowed).flatMap((g) => g.entries);
    expect(entries.find((e) => e.rabbis[0] === place('gamliel-a'))).toMatchObject({ single: true });
  });

  it('count a name that can mean several people as one choice that asks which', () => {
    const entries = quickPicks(data).flatMap((g) => g.entries);
    expect(entries.map((e) => e.single)).toEqual([false, true, true, true]);
  });
});

const hue = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('colours for the picks', () => {
  const pick = (...ids: string[]) => pickColors(ids.map((id) => rabbis[place(id)]));

  it('keeps a lone rabbi in his generation’s Dating colour', () => {
    expect(pick('lakish')[0]).toEqual(generationColor('A2'));
    expect(pick('lakish')[0]).toEqual(pick('yochanan')[0]);
  });

  const gens = (...codes: string[]) =>
    pickColors(codes.map((gen) => ({ id: gen, en: gen, he: '', gen, names: [] })));

  // Each era is a family of hues: the first two picks sit at its two ends.
  const families: [string, string, number, number][] = [
    ['Amoraim', 'A4', 190, 275],
    ['Tannaim', 'T3', 15, 70],
    ['Zugot', 'Z5', 295, 360],
  ];
  for (const [era, code, from, to] of families) {
    it(`gives three ${era} equal lightness and hues far apart, two of them at the ends of the family`, () => {
      const [a, b, c] = gens(code, code, code).map(rgbToOklch);
      for (const other of [b, c]) expect(Math.abs(other.l - a.l)).toBeLessThan(0.01);
      expect(hue(a.h, b.h)).toBeGreaterThan(35);
      expect(hue(a.h, c.h)).toBeGreaterThan(35);
      expect(hue(b.h, c.h)).toBeGreaterThan(35);
      for (const { h } of [a, b]) {
        expect(h).toBeGreaterThan(from > 290 && h < 100 ? from - 360 : from);
        expect(h < 100 && from > 290 ? h + 360 : h).toBeLessThan(to + 0.001);
      }
    });
  }

  it('keeps the ends of each family clear of the next, and of the Mishnah’s violet', () => {
    const ends = (code: string) => gens(code, code).map((c) => rgbToOklch(c).h);
    const [teal, indigo] = ends('A4');
    const [orange, crimson] = ends('T3');
    const [pink, violet] = ends('Z5');
    expect(hue(indigo, violet)).toBeGreaterThan(30);
    expect(hue(crimson, pink)).toBeGreaterThan(30);
    expect(hue(teal, orange)).toBeGreaterThan(60);
    const mishnah = rgbToOklch([...MISHNAH_BASE_COLOR] as [number, number, number]).h;
    expect(hue(indigo, mishnah)).toBeGreaterThan(30);
  });

  it('gives rabbis of different eras different hues', () => {
    const [a, b] = pick('lakish', 'gamliel-a').map(rgbToOklch);
    expect(hue(a.h, b.h)).toBeGreaterThan(60);
  });
});

describe('a rabbi Sefaria gives no generation', () => {
  const levi: Rabbi = { id: 'levi', en: 'Levi', he: 'לוי', gen: UNDATED, names: [] };

  it('is coloured from the Amoraim, and told apart from an Amora picked beside him', () => {
    expect(pickColors([levi])[0]).toEqual(generationColor('A4'));
    const [a, b] = pickColors([rabbis[2], levi]).map(rgbToOklch);
    expect(hue(a.h, b.h)).toBeGreaterThan(30);
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
    expect(picksFromUrl('a,b,c,d,e,f,g,h')).toHaveLength(4);
    expect(picksFromUrl(undefined)).toEqual([]);
  });
});
