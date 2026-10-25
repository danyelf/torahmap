import { describe, it, expect } from 'vitest';
import { tropOverlay, RARE_MATCH_COLOR } from '../../../src/overlays/trop';
import {
  signsOf,
  systemOf,
  TROP_MARKS,
  SYSTEM_INFO,
  SYSTEMS,
} from '../../../src/overlays/trop/marks';
import { hostOverlay } from '../../helpers/overlayHost';
import { createVerse } from '../../helpers/fixtures';
import type { VerseTexts } from '../../../src/verseTexts';

const TIPCHA = 'ב֖';
const ETNACH = 'ב֑';
const ZARQA_ZINOR = 'ב֮';
const ZARQA_VARIANT = 'ב֘';
const REVIA = 'ב֗';
const REVIA_MUGRASH = 'ב֝֗';

function texts(verses: Record<string, string>): VerseTexts {
  const out: VerseTexts = {};
  for (const [place, he] of Object.entries(verses)) {
    const [book, chapter, verse] = place.split(' ');
    ((out[book] ??= {})[chapter] ??= {})[verse] = { he, en: '' };
  }
  return out;
}

/** The places whose verses a mark colors, with the chart on `tab`. */
function lit(verses: Record<string, string>, trop: string, tab = 'prose'): string[] {
  const host = hostOverlay(tropOverlay, { texts: texts(verses) });
  host.restore({ trop, tab });
  return Object.keys(verses).filter((place) => {
    const [book, chapter, verse] = place.split(' ');
    const color = host.getItemColor(
      createVerse({ book, chapter: Number(chapter), verse: Number(verse) }),
    );
    return JSON.stringify(color) === JSON.stringify(RARE_MATCH_COLOR);
  });
}

describe('which verses are poetic', () => {
  it.each([
    ['Genesis', 1, 1, 'prose'],
    ['Psalms', 1, 1, 'poetic'],
    ['Proverbs', 31, 31, 'poetic'],
    ['Job', 1, 1, 'prose'],
    ['Job', 3, 1, 'prose'],
    ['Job', 3, 2, 'poetic'],
    ['Job', 42, 6, 'poetic'],
    ['Job', 42, 7, 'prose'],
  ])('%s %i:%i is %s', (book, chapter, verse, system) => {
    expect(systemOf(book, chapter, verse)).toBe(system);
  });
});

describe('a mark and the verses it colors', () => {
  const verses = {
    'Genesis 1 1': TIPCHA,
    'Job 1 1': TIPCHA,
    'Job 3 2': TIPCHA,
    'Psalms 1 1': TIPCHA,
    'Psalms 1 2': ETNACH,
    'Genesis 1 2': ETNACH,
  };

  it('keeps a sign that is a different mark in poetry to the prose verses', () => {
    expect(lit(verses, 'tipcha')).toEqual(['Genesis 1 1', 'Job 1 1']);
  });

  it('keeps the poetic mark that shares that sign to the poetic verses', () => {
    expect(lit(verses, 'tarcha', 'poetic')).toEqual(['Job 3 2', 'Psalms 1 1']);
  });

  it('colors a shared mark in every verse that carries it, from either tab', () => {
    const both = ['Psalms 1 2', 'Genesis 1 2'];
    expect(lit(verses, 'etnachta', 'prose')).toEqual(both);
    expect(lit(verses, 'etnachta', 'poetic')).toEqual(both);
  });

  it('colors nothing for a mark the tab does not offer', () => {
    expect(lit(verses, 'tarcha', 'prose')).toEqual([]);
    expect(lit(verses, 'tipcha', 'poetic')).toEqual([]);
  });

  it('counts both zarqa signs in prose, but only one in poetry', () => {
    const zarqa = {
      'Genesis 1 1': ZARQA_ZINOR,
      'Genesis 1 2': ZARQA_VARIANT,
      'Psalms 1 1': ZARQA_ZINOR,
      'Psalms 1 2': ZARQA_VARIANT,
    };
    expect(lit(zarqa, 'zarqa')).toEqual(['Genesis 1 1', 'Genesis 1 2', 'Psalms 1 1']);
    expect(lit(zarqa, 'tsinnorit', 'poetic')).toEqual(['Psalms 1 2']);
  });

  it('separates revia mugrash from the revia it contains', () => {
    const revia = { 'Psalms 1 1': REVIA_MUGRASH, 'Psalms 1 2': REVIA };
    expect(lit(revia, 'revia', 'poetic')).toEqual(['Psalms 1 2']);
    expect(lit(revia, 'revia-mugrash', 'poetic')).toEqual(['Psalms 1 1']);
  });

  it('does not count the yored of an ole ve-yored as a merkha', () => {
    const verses = { 'Psalms 1 1': 'ב֥֫', 'Psalms 1 2': 'ב֥' };
    expect(lit(verses, 'merkha', 'poetic')).toEqual(['Psalms 1 2']);
    expect(lit(verses, 'ole-ve-yored', 'poetic')).toEqual(['Psalms 1 1']);
  });

  it('counts a yored on the word after its ole as part of the ole ve-yored', () => {
    const verses = { 'Psalms 1 1': 'ב֫ ב֥', 'Psalms 1 2': 'ב ב֥' };
    expect(lit(verses, 'merkha', 'poetic')).toEqual(['Psalms 1 2']);
  });

  it('reads sof pasuq from the meteg on the last word only', () => {
    const verse = {
      'Genesis 1 1': 'אֱלֹהִֽים׃',
      'Genesis 1 2': 'בָּֽרָא אֱלֹהִים׃',
      'Genesis 1 3': 'בָּֽרָא [אֱלֹהִֽים] (אלהים)׃ {פ}',
    };
    expect(lit(verse, 'sof-pasuq')).toEqual(['Genesis 1 1', 'Genesis 1 3']);
  });
});

describe('the tab in the link', () => {
  const host = () => hostOverlay(tropOverlay, { texts: texts({ 'Genesis 1 1': TIPCHA }) });

  it('is left out of the link for prose, and carried for the poetic books', () => {
    const h = host();
    h.restore({ trop: 'munach' });
    expect(h.toUrl()).toEqual({ trop: 'munach' });
    h.restore({ trop: 'munach', tab: 'poetic' });
    expect(h.toUrl()).toEqual({ trop: 'munach', tab: 'poetic' });
  });

  it('changes by clicking its tab, and keeps a mark both tabs offer', () => {
    const h = host();
    const controls = h.renderControls();
    controls.querySelector<HTMLButtonElement>('[data-slug="munach"]')!.click();
    controls.querySelector<HTMLButtonElement>('.trop-tabs [data-tab="poetic"]')!.click();
    expect(h.settings).toMatchObject({ tab: 'poetic', mark: 'munach' });
  });

  it('drops a chosen mark the other tab does not offer', () => {
    const h = host();
    const controls = h.renderControls();
    controls.querySelector<HTMLButtonElement>('[data-slug="tipcha"]')!.click();
    controls.querySelector<HTMLButtonElement>('.trop-tabs [data-tab="poetic"]')!.click();
    expect(h.settings).toMatchObject({ tab: 'poetic', mark: null });
  });

  it('shows one tab at a time', () => {
    const h = host();
    const controls = h.renderControls();
    const shown = () =>
      [...controls.querySelectorAll<HTMLElement>('.trop-chart > [data-tab]')]
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.dataset.tab);
    expect(shown()).toEqual(['prose']);
    controls.querySelector<HTMLButtonElement>('.trop-tabs [data-tab="poetic"]')!.click();
    expect(shown()).toEqual(['poetic']);
  });
});

describe('the marks data', () => {
  it('puts every mark in a group its system draws', () => {
    for (const mark of TROP_MARKS) {
      for (const system of SYSTEMS) {
        const group = mark.groups[system];
        if (group) {
          expect(SYSTEM_INFO[system].groups.map((g) => g.id)).toContain(group);
        }
      }
    }
  });

  it('writes no sign as two marks in one system', () => {
    for (const system of SYSTEMS) {
      const signs = TROP_MARKS.flatMap((mark) => signsOf(mark, system));
      expect(new Set(signs).size).toBe(signs.length);
    }
  });

  it('writes every mark with at least one sign in each system it is used in', () => {
    for (const mark of TROP_MARKS) {
      for (const system of SYSTEMS) {
        if (mark.groups[system]) expect(signsOf(mark, system).length).toBeGreaterThan(0);
      }
    }
  });
});
