import { describe, it, expect } from 'vitest';
import { UNDATED, type Rabbi, type TalmudDating } from '../src/dating.ts';
import {
  eraLine,
  namedIn,
  passagesOf,
  pickedPlaces,
  quickPicks,
  shortName,
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

describe('how a rabbi is named', () => {
  const table: TalmudDating = {
    ...dating,
    generations: [
      { code: 'Z2', from: -140, to: -100 },
      { code: 'T5', from: 135, to: 170 },
      { code: 'A4', from: 320, to: 350 },
    ],
  };
  const meir: Rabbi = { id: 'meir', en: 'Rabbi Meir', he: 'רבי מאיר', gen: 'T5', names: [] };

  it('gives the generation and its years in a list', () => {
    expect(eraLine(meir, table)).toBe('5th-gen Tanna, 135–170');
    expect(eraLine({ ...meir, gen: 'A4' }, table)).toBe('4th-gen Amora, 320–350');
    expect(eraLine({ ...meir, gen: 'Z2' }, table)).toBe('Zugot, 2nd pair, 140–100 BCE');
  });

  it('gives no years to a rabbi with no generation', () => {
    expect(eraLine({ ...meir, gen: UNDATED }, table)).toBe('Undated');
  });

  it('shortens Rabbi and רבי, and nothing else, where space is short', () => {
    expect(shortName(meir)).toBe('R. Meir ר׳ מאיר');
    expect(shortName({ ...meir, en: 'Rav Ashi', he: 'רב אשי' })).toBe('Rav Ashi רב אשי');
    expect(shortName({ ...meir, en: 'Rabbi Yehuda b. Rabbi Ilai', he: '' })).toBe(
      'R. Yehuda b. R. Ilai',
    );
  });

  it('keeps a title that has no name after it, and words that only contain one', () => {
    expect(shortName({ ...meir, en: 'Rabbi Shimon b. Rabbi', he: 'רבי שמעון בן רבי' })).toBe(
      'R. Shimon b. Rabbi ר׳ שמעון בן רבי',
    );
    expect(shortName({ ...meir, en: 'Rabi', he: 'רבי' })).toBe('Rabi רבי');
    expect(shortName({ ...meir, en: 'Rabbinic X', he: 'רבינא' })).toBe('Rabbinic X רבינא');
    expect(shortName({ ...meir, en: 'Bar Rabbi', he: 'ברבי עקיבא' })).toBe('Bar Rabbi ברבי עקיבא');
  });
});
