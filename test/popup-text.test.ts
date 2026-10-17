// What each text's popup says of a square.
import { describe, expect, it } from 'vitest';
import { readLink } from '@torahmap/link';
import { LINK_KEYS } from '@torahmap/overlay-catalog';
import { popupText } from '@torahmap/tanakh/popup.ts';
import { talmudText } from '@torahmap/talmud/text.ts';
import { STRUCTURE_FILE, textsFile } from '@torahmap/talmud/data.ts';
import { TEXTS_FILE } from '@torahmap/tanakh/verseTexts.ts';
import { createVerse, testOverlay } from '../apps/tanakh/test/helpers/index';
import { talmudFixture } from '../apps/talmud/test/helpers/talmudFixture';

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
      getItemColor: () => null,
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
  // "Its" in 2a:2 cites a verse.
  const citations = { 0: { 1: [{ start: 0, end: 3, verse: 'Psalms.36.7' }] } };
  const english = [['', '*Its* second'], ['']];
  const file = { name: 'TractA', amudim, english, citations };
  const open = talmudText.open(
    new Map<string, unknown>([
      [STRUCTURE_FILE, talmudFixture],
      [textsFile('TractA'), file],
    ]),
  );
  const second = open.items.find((s) => s.tractate === 'TractA' && s.daf === 2 && s.segment === 2)!;

  it("says the segment's reference, text and English, and links to it on Sefaria", () => {
    expect(open.popupText(second, new Map([[textsFile('TractA'), file]]), null)).toMatchObject({
      ref: 'TractA 2a:2',
      hebrew: 'Its second',
      english: 'Its second',
      englishStyles: [{ start: 0, end: 3, style: 'bold' }],
      link: 'https://www.sefaria.org/TractA.2a.2',
    });
  });

  it('links each verse the segment cites to the Tanakh map, shaded by the Talmud’s commentary', () => {
    const [cited] = open.popupText(
      second,
      new Map([[textsFile('TractA'), file]]),
      null,
    ).hebrewLinks!;
    expect(cited).toMatchObject({ start: 0, end: 3 });
    expect(cited.href.startsWith('/?')).toBe(true);
    expect(readLink(cited.href.slice(1), LINK_KEYS)).toMatchObject({
      square: 'Psalms.36.7',
      overlay: 'commentary',
      overlayParams: { category: 'Talmud' },
    });
  });

  it('is empty until its tractate is in', () => {
    expect(open.popupText(second, new Map(), null).hebrew).toBe('');
  });
});
