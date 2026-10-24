import { describe, it, expect } from 'vitest';
import { talmudFixture } from '../../../apps/talmud/test/helpers/talmudFixture.ts';
import { datingFrom, placeIn, type Facts, type Mention, type Placement } from '../dating.ts';

const ARAMAIC = 'William Davidson Edition - Aramaic';

const periods: Facts['periods'] = {
  T5: { from: 135, to: 170 },
  A2: { from: 250, to: 290 },
  A3: { from: 290, to: 320 },
  A4: { from: 320, to: 350 },
  'A2/A3': { from: 250, to: 320 },
};

const topics: Facts['topics'] = {
  meir: { en: 'Rabbi Meir', he: 'רבי מאיר', generation: 'T5' },
  rava: { en: 'Rava', he: 'רבא', generation: 'A4' },
  abaye: { en: 'Abaye', he: 'אביי', generation: 'A4' },
  yohanan: { en: 'Rabbi Yohanan', he: 'רבי יוחנן', generation: 'A2' },
  hanina: { en: 'Rabbi Hanina', he: 'רבי חנינא', generation: 'A2/A3' },
  rav: { en: 'Rav', he: 'רב', generation: 'A2' },
  'rav-shmuel': { en: 'Rav Shmuel', he: 'רב שמואל', generation: 'A3' },
  nobody: { en: 'Someone', he: 'מישהו', generation: null },
  'elazar-(ambiguous)': { en: 'Rabbi Elazar', he: 'ר"א', generation: null },
  'elazar-a': { en: 'Elazar b. Shammua', he: 'אלעזר בן שמוע', generation: 'T5' },
  'elazar-b': { en: 'Elazar b. Pedat', he: 'אלעזר בן פדת', generation: 'A3' },
};

const candidates = { 'elazar-(ambiguous)': ['elazar-a', 'elazar-b'] };

const mention = (ref: string, topic: string, over: Partial<Mention> = {}): Mention => ({
  ref,
  topic,
  language: 'he',
  version: ARAMAIC,
  start: 0,
  end: 4,
  text: 'רבא',
  ...over,
});

// TractA's amudim have 5, 4, 6 and 3 segments, TractB's 2.
const lines = (counts: number[], line: string) => counts.map((n) => Array(n).fill(line));
const texts = new Map([
  ['TractA', lines([5, 4, 6, 3], 'אמר רבא')],
  ['TractB', lines([2, 2], 'אמר רבא')],
]);

const build = (mentions: Mention[], placement?: Placement, withTexts = texts) =>
  datingFrom({ mentions, candidates, topics, periods }, talmudFixture, withTexts, placement);

const at = (dating: ReturnType<typeof build>, id: string) => {
  const segment = dating.segments[id];
  return (
    segment && {
      code: dating.generations[segment[0]].code,
      uncertain: segment[1],
      names: segment[2].map((p) => dating.people[p].en),
    }
  );
};

describe('datingFrom', () => {
  it('dates a segment by the latest generation among its rabbis', () => {
    const dating = build([
      mention('TractA 2a:1', 'meir'),
      mention('TractA 2a:1', 'rava', { start: 10, end: 14 }),
      mention('TractA 2a:1', 'yohanan', { start: 20, end: 24 }),
    ]);
    expect(at(dating, 'TractA.2a.1')).toMatchObject({ code: 'A4', uncertain: 0 });
  });

  it('counts a two-generation code as the later generation', () => {
    const dating = build([mention('TractA 2a:1', 'hanina')]);
    expect(at(dating, 'TractA.2a.1')?.code).toBe('A3');
  });

  it('ignores tags found only in the English or in other editions', () => {
    const dating = build([
      mention('TractA 2a:1', 'rava', {
        language: 'en',
        version: 'William Davidson Edition - English',
      }),
      mention('TractA 2a:2', 'rava', { version: 'Wikisource Talmud Bavli' }),
      mention('TractA 2a:3', 'rava', { version: 'William Davidson Edition - Vocalized Aramaic' }),
    ]);
    expect(dating.segments).toEqual({});
  });

  it('names a rabbi once however many times he is tagged', () => {
    const dating = build([
      mention('TractA 2a:1', 'rava'),
      mention('TractA 2a:1', 'rava', { start: 10, end: 14 }),
    ]);
    expect(at(dating, 'TractA.2a.1')?.names).toEqual(['Rava']);
  });

  it('dates nothing through a person with no generation', () => {
    const dating = build([mention('TractA 2a:1', 'nobody')]);
    expect(dating.segments).toEqual({});
  });

  it('marks a segment dated only by an ambiguous name uncertain, at its latest candidate', () => {
    const dating = build([mention('TractA 2a:1', 'elazar-(ambiguous)')]);
    expect(at(dating, 'TractA.2a.1')).toEqual({
      code: 'A3',
      uncertain: 1,
      names: ['Rabbi Elazar'],
    });
  });

  it('lists an ambiguous name beside a resolved one without letting it date the segment', () => {
    const dating = build([
      mention('TractA 2a:1', 'meir'),
      mention('TractA 2a:1', 'elazar-(ambiguous)', { start: 10, end: 14 }),
    ]);
    expect(at(dating, 'TractA.2a.1')).toEqual({
      code: 'T5',
      uncertain: 0,
      names: ['Rabbi Meir', 'Rabbi Elazar'],
    });
  });

  it('drops from the names a tag inside a fuller name, keeping the date', () => {
    const dating = build([
      mention('TractA 2a:1', 'rav', { start: 5, end: 8 }),
      mention('TractA 2a:1', 'rav-shmuel', { start: 0, end: 20 }),
    ]);
    expect(at(dating, 'TractA.2a.1')?.names).toEqual(['Rav Shmuel']);
  });

  it('keeps the contained tag when what holds it dates nothing', () => {
    const dating = build([
      mention('TractA 2a:1', 'rav', { start: 5, end: 8 }),
      mention('TractA 2a:1', 'nobody', { start: 0, end: 20 }),
    ]);
    expect(at(dating, 'TractA.2a.1')?.names).toEqual(['Rav']);
  });

  it('lists the generation of a rabbi named only in segments dated later', () => {
    const dating = build([
      mention('TractA 2a:1', 'yohanan'),
      mention('TractA 2a:1', 'rava', { start: 10, end: 14 }),
    ]);
    const [segment] = Object.values(dating.segments);
    for (const place of segment[2]) {
      expect(dating.generations[dating.people[place].gen]).toBeDefined();
    }
  });

  it('marks a name where the dump tagged it when the map’s text agrees', () => {
    const placement = { exact: 0, nearby: 0, dropped: 0 };
    const dating = build([mention('TractA 2a:1', 'rava', { start: 4, end: 7 })], placement);
    expect(dating.segments['TractA.2a.1'][3]).toEqual([4, 7, 0]);
    expect(placement).toEqual({ exact: 1, nearby: 0, dropped: 0 });
  });

  it('finds a name near where it was tagged when the map spells it differently', () => {
    const placement = { exact: 0, nearby: 0, dropped: 0 };
    const abbreviated = new Map([['TractA', lines([5, 4, 6, 3], "אמר ר' אבא")]]);
    const dating = build(
      [mention('TractA 2a:1', 'meir', { start: 6, end: 14, text: 'רבי אבא' })],
      placement,
      abbreviated,
    );
    expect(dating.segments['TractA.2a.1'][3]).toEqual([4, 10, 0]);
    expect(placement).toEqual({ exact: 0, nearby: 1, dropped: 0 });
  });

  it('drops a name it cannot find in the map’s text, keeping the date', () => {
    const placement = { exact: 0, nearby: 0, dropped: 0 };
    const dating = build(
      [mention('TractA 2a:1', 'rava', { start: 4, end: 9, text: 'רבינא' })],
      placement,
    );
    expect(dating.segments['TractA.2a.1'][3]).toEqual([]);
    expect(at(dating, 'TractA.2a.1')?.code).toBe('A4');
    expect(placement.dropped).toBe(1);
  });

  it('does not find a short name inside a longer word', () => {
    const rav = mention('TractA 2a:1', 'rav', { start: 40, end: 42, text: 'רב' });
    expect(placeIn('אמר רבא', rav)).toBeNull();
    expect(placeIn('אמר רב', rav)).toMatchObject({ start: 4, end: 6 });
  });

  it('finds a name whose prefix the map spells differently', () => {
    const named = mention('TractA 2a:1', 'meir', { start: 2, end: 12, text: 'לרבי יוסי' });
    expect(placeIn('אמר רבי יוסי', named)).toMatchObject({ start: 4 });
  });

  it('marks only the outer name of overlapping tags', () => {
    const dating = build([
      mention('TractA 2a:1', 'rav', { start: 4, end: 7, text: 'רבא' }),
      mention('TractA 2a:1', 'rav-shmuel', { start: 0, end: 7, text: 'אמר רבא' }),
    ]);
    expect(dating.segments['TractA.2a.1'][3]).toEqual([0, 7, 0]);
  });

  it('numbers amudim and segments as the map does', () => {
    const dating = build([mention('TractB 2b:2', 'rava')]);
    expect(Object.keys(dating.segments)).toEqual(['TractB.2b.2']);
  });

  it('lists only the generations that occur, earliest first', () => {
    const dating = build([mention('TractA 2a:1', 'rava'), mention('TractA 2a:2', 'meir')]);
    expect(dating.generations.map((g) => g.code)).toEqual(['T5', 'A4']);
    expect(dating.generations[1]).toEqual({
      code: 'A4',

      from: 320,
      to: 350,
    });
  });

  it('ignores a page that is not a tractate of the map', () => {
    expect(build([mention('Zevachim 2a:1', 'rava')]).segments).toEqual({});
  });

  it('stops on a range ref', () => {
    expect(() => build([mention('TractA 2a:1-3', 'rava')])).toThrow(/range/i);
  });

  it('stops on a segment the map does not have', () => {
    expect(() => build([mention('TractA 2a:6', 'rava')])).toThrow(/segment/i);
  });
});
