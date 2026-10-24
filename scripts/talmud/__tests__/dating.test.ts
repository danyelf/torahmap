import { describe, it, expect } from 'vitest';
import { talmudFixture } from '../../../apps/talmud/test/helpers/talmudFixture.ts';
import { datingFrom, type Facts, type Mention } from '../dating.ts';

const ARAMAIC = 'William Davidson Edition - Aramaic';

const periods: Facts['periods'] = {
  T5: { en: 'Tannaim - Fifth Generation', from: 135, to: 170 },
  A2: { en: 'Amoraim - Second Generation', from: 250, to: 290 },
  A3: { en: 'Amoraim - Third Generation', from: 290, to: 320 },
  A4: { en: 'Amoraim - Fourth Generation', from: 320, to: 350 },
  'A2/A3': { en: 'Amoraim - Second And Third Generations', from: 250, to: 320 },
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
  ...over,
});

const build = (mentions: Mention[]) =>
  datingFrom({ mentions, candidates, topics, periods }, talmudFixture);

const at = (dating: ReturnType<typeof build>, id: string) => {
  const segment = dating.segments[id];
  return (
    segment && {
      code: dating.generations[segment[0]].code,
      uncertain: segment[1],
      names: segment.slice(2).map((p) => dating.people[p as number].en),
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

  it('lets a resolved name settle a segment that also has an ambiguous one', () => {
    const dating = build([
      mention('TractA 2a:1', 'meir'),
      mention('TractA 2a:1', 'elazar-(ambiguous)', { start: 10, end: 14 }),
    ]);
    expect(at(dating, 'TractA.2a.1')).toEqual({ code: 'T5', uncertain: 0, names: ['Rabbi Meir'] });
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

  it('numbers amudim and segments as the map does', () => {
    const dating = build([mention('TractB 2b:2', 'rava')]);
    expect(Object.keys(dating.segments)).toEqual(['TractB.2b.2']);
  });

  it('lists only the generations that occur, earliest first', () => {
    const dating = build([mention('TractA 2a:1', 'rava'), mention('TractA 2a:2', 'meir')]);
    expect(dating.generations.map((g) => g.code)).toEqual(['T5', 'A4']);
    expect(dating.generations[1]).toEqual({
      code: 'A4',
      name: 'Amoraim, 4th generation',
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
