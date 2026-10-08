// What each text's popup says of a square.
import { describe, expect, it } from 'vitest';
import { popupText } from '../../tanakh/popup';
import { talmudText } from '../../talmud/text';
import { STRUCTURE_FILE, textsFile } from '../../talmud/data';
import { TEXTS_FILE } from '../../verseTexts';
import { createVerse, testOverlay } from '../helpers';
import { talmudFixture } from '../helpers/talmudFixture';

describe("the Tanakh's popup", () => {
  const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
  const loaded = new Map([
    [TEXTS_FILE, { Genesis: { 1: { 1: { he: 'בְּרֵאשִׁית', en: 'In the beginning' } } } }],
  ]);

  it("says the verse's reference and text", () => {
    expect(popupText(verse, loaded, null)).toMatchObject({
      ref: 'Genesis 1:1',
      hebrew: 'בְּרֵאשִׁית',
      english: 'In the beginning',
    });
  });

  it('is empty until the texts are in', () => {
    expect(popupText(verse, new Map(), null)).toMatchObject({ hebrew: '', english: '' });
  });

  it('links to Sefaria at the commentary the overlay picks', () => {
    const commentary = testOverlay({
      id: 'commentary',
      name: 'Commentary',
      getVerseColor: () => null,
      getSefariaConnectionParam: (settings: { category: string }) => settings.category,
    });
    const overlay = { tool: commentary, settings: { category: 'Midrash' }, data: undefined };
    expect(popupText(verse, loaded, overlay).link).toBe(
      'https://www.sefaria.org/Genesis.1.1?with=Midrash',
    );
  });
});

describe("the Talmud's popup", () => {
  const amudim = [['The first segment of 2a', 'Its second'], ['A segment of 2b']];
  const open = talmudText.open(
    new Map<string, unknown>([
      [STRUCTURE_FILE, talmudFixture],
      [textsFile('TractA'), { name: 'TractA', amudim }],
    ]),
  );
  const second = open.items.find((s) => s.tractate === 'TractA' && s.daf === 2 && s.segment === 2)!;

  it("says the segment's reference and text, and links to it on Sefaria", () => {
    expect(open.popupText(second, new Map([[textsFile('TractA'), { amudim }]]), null)).toEqual({
      ref: 'TractA 2a:2',
      hebrew: 'Its second',
      english: '',
      link: 'https://www.sefaria.org/TractA.2a.2',
    });
  });

  it('is empty until its tractate is in', () => {
    expect(open.popupText(second, new Map(), null).hebrew).toBe('');
  });
});
