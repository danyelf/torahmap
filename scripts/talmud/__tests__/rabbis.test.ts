import { describe, it, expect } from 'vitest';
import type { Facts } from '../facts.ts';
import { rabbisFrom } from '../rabbis.ts';

const periods: Facts['periods'] = {
  T3: { from: 80, to: 110 },
  T5: { from: 135, to: 170 },
  A2: { from: 250, to: 290 },
};

const topic = (en: string, generation: string | null, names: string[] = [en]) => ({
  en,
  he: '',
  generation,
  names,
});

const facts: Facts = {
  mentions: [],
  periods,
  topics: {
    lakish: topic('Rabbi Shimon b. Lakish', 'A2', ['Reish Lakish', 'Rabbi Shimon b. Lakish']),
    'gamliel-a': topic('Rabban Gamliel haZaken', 'T3'),
    'gamliel-b': topic('Rabban Gamliel b. Rabbi', 'T5'),
    'gamliel-undated': topic('Gamliel the unplaced', null),
    'gamliel-(ambiguous)': topic('Rabban Gamliel', null, ['Gamliel', 'Rabban Gamliel']),
    'yosef-(ambiguous)': topic('Rav Yosef', null),
    yosef: topic('Rav Yosef b. Hiyya', 'A2'),
    'untagged-(ambiguous)': topic('Someone', null),
  },
  candidates: {
    'gamliel-(ambiguous)': ['gamliel-a', 'gamliel-b', 'gamliel-undated'],
    'yosef-(ambiguous)': ['yosef'],
  },
};

const dating = {
  generations: [],
  segments: {},
  people: ['gamliel-(ambiguous)', 'lakish', 'yosef-(ambiguous)'].map((id) => ({
    id,
    en: '',
    he: '',
    gen: 0,
  })),
};
const { rabbis, readings } = rabbisFrom(facts, dating);
const ids = rabbis.map((r) => r.id);

describe('rabbisFrom', () => {
  it('makes rabbis of the people with a generation that a listed name can mean', () => {
    expect(ids).toEqual(['gamliel-a', 'gamliel-b', 'lakish', 'yosef']);
  });

  it('reads a plain person as himself, for certain', () => {
    expect(readings[1]).toEqual([1, ids.indexOf('lakish')]);
  });

  it('reads a name with one candidate as that person, for certain', () => {
    expect(readings[2]).toEqual([1, ids.indexOf('yosef')]);
  });

  it('reads a name with several candidates as each of them, not for certain', () => {
    expect(readings[0]).toEqual([0, ids.indexOf('gamliel-a'), ids.indexOf('gamliel-b')]);
  });

  it('gives a rabbi the other names of the shared names that can mean him', () => {
    const gamliel = rabbis[ids.indexOf('gamliel-a')];
    expect(gamliel.names).toEqual(['Gamliel', 'Rabban Gamliel', 'Rabban Gamliel haZaken']);
  });

  it('gives a rabbi every name Sefaria records for him', () => {
    expect(rabbis[ids.indexOf('lakish')].names).toContain('Reish Lakish');
  });

  it('gives each rabbi his generation code', () => {
    expect(rabbis[ids.indexOf('gamliel-b')].gen).toBe('T5');
  });
});
